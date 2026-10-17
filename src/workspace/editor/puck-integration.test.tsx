// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Puck } from "@puckeditor/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createProject, newBlock, projectSchema, type Block } from "@/shared/portfolio/schema";
import { portfolioConfig, toEditorData, useEditor } from "./config";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
});
afterEach(cleanup);

function Controls() {
  const content = useEditor((state) => state.appState.data.content);
  const dispatch = useEditor((state) => state.dispatch);
  const first = content[0];
  const columns = <button onClick={() => dispatch({ type: "setData", data: (data) => ({ ...data, content: [...data.content, newBlock("Columns")] }) })}>Add guided columns</button>;
  return <>{columns}<label>Heading<input aria-label="Test heading" value={first.props.title} onChange={(event) => dispatch({ type: "replace", destinationIndex: 0, destinationZone: "root:default-zone", data: { ...first, props: { ...first.props, title: event.target.value } } })}/></label><button onClick={() => dispatch({ type: "insert", componentType: "Text", destinationIndex: content.length, destinationZone: "root:default-zone" })}>Add a text section</button><button onClick={() => dispatch({ type: "duplicate", sourceIndex: 0, sourceZone: "root:default-zone" })}>Duplicate introduction</button></>;
}

describe("the Puck document adapter", () => {
  it("persists custom control edits and creates unique, valid sections", async () => {
    const project = createProject();
    let blocks: Block[] = project.pages[0].blocks;
    render(<Puck config={portfolioConfig(project, "")} data={toEditorData(project.pages[0])} iframe={{ enabled: false }} onChange={(data) => { blocks = data.content as Block[]; }}><Controls/></Puck>);
    fireEvent.change(screen.getByLabelText("Test heading"), { target: { value: "A real edit in the editor" } });
    await waitFor(() => expect(blocks[0].props.title).toBe("A real edit in the editor"));
    fireEvent.click(screen.getByText("Add a text section"));
    await waitFor(() => expect(blocks).toHaveLength(4));
    fireEvent.click(screen.getByText("Duplicate introduction"));
    await waitFor(() => expect(blocks).toHaveLength(5));
    expect(new Set(blocks.map((block) => block.props.id)).size).toBe(5);
    fireEvent.click(screen.getByText("Add guided columns"));
    await waitFor(() => expect(blocks).toHaveLength(6));
    expect(blocks[5].props.columnsContent).toHaveLength(2);
    project.pages[0].blocks = blocks;
    expect(projectSchema.safeParse(project).success).toBe(true);
  });
});
