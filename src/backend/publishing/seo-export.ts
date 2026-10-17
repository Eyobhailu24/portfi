import type JSZip from "jszip";
import type { Project } from "@/shared/portfolio/schema";

/** These files run at the exported site's build time, with its own hosting URL. */
export function addSeoFiles(zip: JSZip, project: Project) {
  zip.file("portfolio/site-url.ts", `const explicit = process.env.NEXT_PUBLIC_SITE_URL;
const hosted = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const siteUrl = new URL(explicit || (hosted ? "https://" + hosted : "http://localhost:3000"));
if (!["http:", "https:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) throw new Error("NEXT_PUBLIC_SITE_URL must be a public HTTP(S) URL.");
`);
  zip.file("app/layout.tsx", `import type { ReactNode } from "react";
import { siteUrl } from "../portfolio/site-url";
import "./globals.css";
export const metadata = { metadataBase: siteUrl, title: ${JSON.stringify(project.name)}, description: ${JSON.stringify(project.pages.find((page) => !page.slug)!.description)} };
export default function Layout({children}: {children: ReactNode}) { return <html lang="en"><body>{children}<script src="/portfolio-motion.js" defer /></body></html>; }
`);
  zip.file("app/sitemap.ts", `import type { MetadataRoute } from "next";
import project from "../portfolio/project.json";
import { siteUrl } from "../portfolio/site-url";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return project.pages.map((page) => ({ url: new URL(page.slug ? "/" + page.slug + "/" : "/", siteUrl).href }));
}
`);
  zip.file("app/robots.ts", `import type { MetadataRoute } from "next";
import { siteUrl } from "../portfolio/site-url";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/" }, sitemap: new URL("/sitemap.xml", siteUrl).href }; }
`);
  for (const page of project.pages) {
    const prefix = page.slug ? "../../" : "../";
    const canonical = page.slug ? `/${page.slug}/` : "/";
    const metadata = {
      title: page.title || `${page.name} — ${project.profile.name}`, description: page.description,
      alternates: { canonical },
      openGraph: { title: page.title || `${page.name} — ${project.profile.name}`, description: page.description, url: canonical, ...(page.socialImage ? { images: [page.socialImage] } : {}) },
      ...(project.favicon ? { icons: { icon: project.favicon } } : {}),
    };
    zip.file(`app/${page.slug ? `${page.slug}/` : ""}page.tsx`, `import project from "${prefix}portfolio/project.json";
import { PortfolioDocument } from "${prefix}portfolio/components";
import type { Project } from "${prefix}portfolio/schema";
export const metadata = ${JSON.stringify(metadata)};
export default function Page() { return <PortfolioDocument project={project as Project} pageSlug=${JSON.stringify(page.slug)} />; }
`);
  }
  // Static hosts without Vercel redirects still get a navigable old URL.
  for (const redirect of project.redirects) {
    const slug = project.pages.find((page) => page.id === redirect.toPageId)!.slug;
    const target = slug ? `/${slug}/` : "/";
    zip.file(`app/${redirect.from}/page.tsx`, `export const metadata = { robots: { index: false, follow: true }, alternates: { canonical: ${JSON.stringify(target)} } };
export default function RedirectPage() { return <><meta httpEquiv="refresh" content=${JSON.stringify(`0;url=${target}`)} /><main><p>This page has moved.</p><a href=${JSON.stringify(target)}>Continue to the new page</a></main></>; }
`);
  }
  zip.file(".env.example", "# Set your public domain before building outside Vercel, or when using a custom domain.\nNEXT_PUBLIC_SITE_URL=\n");
}
