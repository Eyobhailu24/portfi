// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createProject } from "@/shared/portfolio/schema";
import { backupKey, useAutosave } from "./use-autosave";

const { put } = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("@/workspace/api/client", () => ({
  api: { api: { projects: { ":id": { $put: put } } } },
  json: async (response: Response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; },
}));
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}
beforeEach(() => { put.mockReset(); localStorage.clear(); });
afterEach(cleanup);

describe("autosave under real editing timing", () => {
  it("serializes saves and preserves edits made while an earlier save is pending", async () => {
    const initial = createProject(); initial.revision = 1;
    const first = { ...initial, name: "First edit" };
    const second = { ...initial, name: "A newer edit while saving" };
    let acknowledgeFirst!: (value: Response) => void;
    let acknowledgeSecond!: (value: Response) => void;
    put.mockImplementationOnce(() => new Promise<Response>((resolve) => { acknowledgeFirst = resolve; }));
    put.mockImplementationOnce(() => new Promise<Response>((resolve) => { acknowledgeSecond = resolve; }));
    const { result, rerender } = renderHook(({ project }) => useAutosave(project, initial), { initialProps: { project: initial }, wrapper });
    rerender({ project: first });
    let flush!: Promise<void>;
    act(() => { flush = result.current.flush(); });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    rerender({ project: second });
    await act(async () => { acknowledgeFirst(Response.json({ project: { ...first, revision: 2 } })); });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][0].json.expectedRevision).toBe(2);
    expect(put.mock.calls[1][0].json.project.name).toBe(second.name);
    await act(async () => { acknowledgeSecond(Response.json({ project: { ...second, revision: 3 } })); await flush; });
    await waitFor(() => expect(result.current.dirty).toBe(false));
    expect(localStorage.getItem(backupKey(initial.id))).toBeNull();
  });

  it("retains a recoverable draft and reports a server revision conflict", async () => {
    const initial = createProject(); initial.revision = 1;
    put.mockResolvedValue(Response.json({ error: "Changed in another tab" }, { status: 409 }));
    const next = { ...initial, name: "Do not lose this work" };
    const { result, rerender } = renderHook(({ project }) => useAutosave(project, initial), { initialProps: { project: initial }, wrapper });
    rerender({ project: next });
    await act(async () => { await expect(result.current.flush()).rejects.toThrow("Changed in another tab"); });
    expect(result.current.dirty).toBe(true);
    expect(JSON.parse(localStorage.getItem(backupKey(initial.id))!).project.name).toBe(next.name);
  });
});
