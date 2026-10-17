import { describe, expect, it } from "vitest";
import { createProject, duplicatePage, projectSchema, templateMeta } from "./schema";

describe("portable portfolio documents", () => {
  it.each(templateMeta.map((item) => item.id))("creates a valid multi-page %s portfolio", (template) => {
    const project = createProject(template);
    expect(projectSchema.parse(project).pages).toHaveLength(2);
  });

  it("remaps section IDs and avoids page slug collisions when duplicating", () => {
    const project = createProject();
    const original = project.pages[0];
    const duplicate = duplicatePage(original, ["", "home-copy"]);
    expect(duplicate.slug).toBe("home-copy-2");
    expect(new Set([...original.blocks, ...duplicate.blocks].map((block) => block.props.id)).size).toBe(original.blocks.length + duplicate.blocks.length);
    project.pages.push(duplicate);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it("rejects duplicate routes and executable URLs", () => {
    const duplicateRoutes = createProject();
    duplicateRoutes.pages[1].slug = "";
    expect(projectSchema.safeParse(duplicateRoutes).success).toBe(false);
    const unsafe = createProject();
    unsafe.pages[0].blocks[1].props.items[0].url = "javascript:alert(1)";
    expect(projectSchema.safeParse(unsafe).success).toBe(false);
    unsafe.pages[0].blocks[1].props.items[0].url = "//external.example";
    expect(projectSchema.safeParse(unsafe).success).toBe(false);
  });

  it("rejects local filesystem paths and untrusted remote asset references", () => {
    const project = createProject();
    project.pages[0].blocks[1].props.items[0].image = "../../private-file";
    expect(projectSchema.safeParse(project).success).toBe(false);
    project.pages[0].blocks[1].props.items[0].image = "https://untrusted.example/tracking.png";
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
});
