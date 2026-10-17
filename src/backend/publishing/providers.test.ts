import { afterEach, expect, it, vi } from "vitest";
import { githubClient } from "./providers";
import type { Identity } from "@/backend/services/identity";
vi.mock("./connections", () => ({ connectionToken: async () => ({ access: "fixture-token", account: "portfolio-owner" }) }));
afterEach(() => vi.unstubAllGlobals());
const user: Identity = { id: "fixture", mode: "account", name: "", email: "", verified: true };

it("does not write to an unrelated existing repository", async () => {
  const fetcher = vi.fn(async (url: string) => url.includes("contents/") ? new Response("{}", { status: 404 }) : Response.json({ id: 1, full_name: "portfolio-owner/existing", default_branch: "main", description: "My own code" }));
  vi.stubGlobal("fetch", fetcher);
  await expect((await githubClient(user)).ensureRepository("existing", "portfolio-id", "job-id")).rejects.toThrow(/not managed/);
  expect(fetcher.mock.calls.every((call) => !((call as unknown[])[1] as RequestInit | undefined)?.method)).toBe(true);
});
it("refuses external edits and recognizes a completed commit after a retry", async () => {
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes("/git/ref/") ? { object: { sha: "external-head" } } : { sha: "external-head", tree: { sha: "tree" }, message: "Manually edited" }));
  vi.stubGlobal("fetch", fetcher);
  const client = await githubClient(user);
  const repo = { full_name: "portfolio-owner/managed", default_branch: "main" };
  await expect(client.commit(repo, [], "project", "job", "expected-head")).rejects.toThrow(/outside Portfi/);
  fetcher.mockImplementation(async (url: string) => Response.json(url.includes("/git/ref/") ? { object: { sha: "done" } } : { sha: "done", tree: { sha: "tree" }, message: "Portfi project · job" }));
  await expect(client.commit(repo, [], "project", "job", "expected-head")).resolves.toBe("done");
});
