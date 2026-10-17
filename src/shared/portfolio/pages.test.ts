import { expect, it } from "vitest";
import { createProject, duplicatePage, newBlock, projectSchema } from "./schema";
import { makeHomePage, removePage, renamePage } from "./pages";

it("keeps internal links stable across slugs and home-page changes", () => {
  const project = createProject(); const about = project.pages[1];
  project.pages[0].blocks[1].props.items[0].url = "/about";
  const columns = newBlock("Columns");
  columns.props.columnsContent[0].kind = "Links";
  columns.props.columnsContent[0].content.items = [{ ...project.pages[0].blocks[1].props.items[0], url: "/about" }];
  project.pages[0].blocks.push(columns);
  const renamed = renamePage(project, about.id, "my-story");
  expect(renamed.pages[0].blocks[1].props.items[0].pageId).toBe(about.id);
  expect(renamed.pages[0].blocks.at(-1)!.props.columnsContent[0].content.items[0].pageId).toBe(about.id);
  expect(renamed.redirects).toContainEqual({ from: "about", toPageId: about.id });
  const home = makeHomePage(renamed, about.id);
  expect(home.pages.find((page) => page.id === about.id)!.slug).toBe("");
  expect(projectSchema.safeParse(home).success).toBe(true);
  const removed = removePage(renamed, about.id);
  expect(removed.pages[0].blocks[1].props.items[0].pageId).toBeUndefined();
  expect(removed.pages[0].blocks[1].props.items[0].url).toBe("");
  expect(removed.pages[0].blocks.at(-1)!.props.columnsContent[0].content.items[0].url).toBe("");
  expect(() => renamePage(project, about.id, "bad--slug")).toThrow();
});
it("remaps nested column IDs when duplicating a page", () => {
  const project = createProject(); project.pages[0].blocks.push(newBlock("Columns"));
  const copy = duplicatePage(project.pages[0], project.pages.map((page) => page.slug));
  project.pages.push(copy);
  expect(projectSchema.safeParse(project).success).toBe(true);
});
