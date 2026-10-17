import JSZip from "jszip";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { projectSchema, type Project } from "@/shared/portfolio/schema";
import { addSeoFiles } from "./seo-export";

export async function exportProject(input: Project, assets: { name: string; buffer: Buffer }[] = []): Promise<Buffer> {
  const project = projectSchema.parse(input);
  const zip = new JSZip();
  const root = process.cwd();
  const source = path.join(root, "src", "shared", "portfolio");
  zip.file("portfolio/project.json", JSON.stringify(project, null, 2));
  zip.file("package-lock.json", await readFile(path.join(root, "src", "backend", "publishing", "export-template", "package-lock.json")));
  for (const name of ["components.tsx", "rich-text.tsx", "schema.ts", "templates.ts", "portfolio.css"]) zip.file(`portfolio/${name}`, await readFile(path.join(source, name)));
  for (const name of await readdir(path.join(root, "public", "assets"))) {
    const used = !name.endsWith(".webp") || project.pages.some((page) => JSON.stringify(page).includes(`/assets/${name}`));
    if (used) zip.file(`public/assets/${name}`, await readFile(path.join(root, "public", "assets", name)));
  }
  zip.file("public/portfolio-motion.js", await readFile(path.join(root, "public", "portfolio-motion.js")));
  for (const asset of assets) {
    if (!/^uploads\/[a-f0-9-]{36}(?:-(?:640|960))?\.(?:webp|jpg|png|woff2)$/.test(asset.name)) throw new Error("Invalid export asset path.");
    zip.file(`public/assets/${asset.name}`, asset.buffer);
  }
  zip.file("app/globals.css", '@import "../portfolio/portfolio.css";\nbody{margin:0}*{box-sizing:border-box}html{scroll-behavior:smooth}a:focus-visible{outline:2px solid currentColor;outline-offset:5px}');
  addSeoFiles(zip, project);
  zip.file("vercel.json", JSON.stringify({ redirects: project.redirects.map((redirect) => ({ source: `/${redirect.from}`, destination: `/${project.pages.find((page) => page.id === redirect.toPageId)!.slug}`, permanent: true })) }, null, 2));
  zip.file("package.json", JSON.stringify({ name: "my-portfi-portfolio", version: "1.0.0", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "16.4.2", react: "19.3.1", "react-dom": "19.3.1", zod: "4.6.7" }, devDependencies: { typescript: "^5.9.0", "@types/node": "^24.0.0", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0" } }, null, 2));
  zip.file("next.config.ts", 'import type { NextConfig } from "next";\nconst config: NextConfig = { output: "export", trailingSlash: true, poweredByHeader: false, turbopack: { root: process.cwd() } };\nexport default config;\n');
  zip.file("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "react-jsx", plugins: [{ name: "next" }] }, include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2));
  zip.file(".gitignore", "node_modules/\n.next/\nout/\n.env*\n!.env.example\n");
  zip.file("README.md", `# ${project.name}\n\nCreated with Portfi. This is your standalone Next.js portfolio.\n\n## Run locally\n\nRequires Node.js 22.13 or later. Run npm install, then npm run dev.\n\n## Publish\n\nPush these files to a GitHub repository you own, then import it into your Vercel account. The project exports static pages to out/. Hosting and domain charges are managed by your hosting provider.\n\n## Search and sharing\n\nVercel system environment variables supply the production URL. For a custom domain or another host, set NEXT_PUBLIC_SITE_URL to your public HTTPS origin before building. Rebuild after changing domains. Canonical links, social images, robots.txt, and sitemap.xml use this origin. A local build defaults to localhost. Enable system environment variables in Vercel project settings.\n\nRenamed pages include Vercel permanent redirects and static fallback pages for other hosts. Source exports are full backups: use Import backup in Portfi to restore content and bundled uploads.\n\n## Your files\n\n- portfolio/project.json: your content and design settings\n- portfolio/components.tsx: the same portfolio components used in the Portfi preview\n- portfolio/portfolio.css: responsive styles and animation presets\n- app/: concrete pages with page-specific metadata\n- public/assets/: bundled images and fonts\n\nThis project does not need a Portfi account, database, editor, or API token to run. Manual code changes do not sync back into the visual editor. Keep your package lockfile after installing dependencies.\n\nSample photographs: Unsplash (see ASSET_CREDITS.md). Font licenses are included in public/assets.\n`);
  zip.file("ASSET_CREDITS.md", await readFile(path.join(root, "ASSET_CREDITS.md")));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
