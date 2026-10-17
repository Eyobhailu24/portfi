import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { exportProject } from "./exporter";
import { createProject } from "@/shared/portfolio/schema";

describe("standalone source export", () => {
  it("bundles concrete routes, shared components, assets, licenses and no editor dependency", async () => {
    const project = createProject("editorial");
    project.name = "My independent portfolio";
    project.redirects = [{ from: "old-about", toPageId: project.pages[1].id }];
    const archive = await JSZip.loadAsync(await exportProject(project));
    expect(archive.file("app/page.tsx")).not.toBeNull();
    expect(archive.file("app/about/page.tsx")).not.toBeNull();
    expect(archive.file("app/old-about/page.tsx")).not.toBeNull();
    expect(archive.file("app/sitemap.ts")).not.toBeNull();
    expect(archive.file("app/robots.ts")).not.toBeNull();
    expect(await archive.file("app/layout.tsx")!.async("string")).toContain("metadataBase: siteUrl");
    expect(await archive.file("app/about/page.tsx")!.async("string")).toContain('"canonical":"/about/"');
    expect(archive.file("public/assets/interior.webp")).not.toBeNull();
    expect(archive.file("public/assets/manrope-LICENSE.txt")).not.toBeNull();
    const saved = JSON.parse(await archive.file("portfolio/project.json")!.async("string"));
    expect(saved).toEqual(project);
    const manifest = JSON.parse(await archive.file("package.json")!.async("string"));
    expect(manifest.dependencies.next).toBeTruthy();
    expect(manifest.dependencies["@puckeditor/core"]).toBeUndefined();
    expect(manifest.dependencies.hono).toBeUndefined();
    expect(manifest.dependencies["better-auth"]).toBeUndefined();
    expect(await archive.file("portfolio/components.tsx")!.async("string")).toContain("export function PortfolioDocument");
  });
});
