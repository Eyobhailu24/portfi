import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  turbopack: { root: path.resolve(process.cwd()) },
  outputFileTracingIncludes: { "/api/**": ["./src/shared/portfolio/components.tsx", "./src/shared/portfolio/rich-text.tsx", "./src/shared/portfolio/schema.ts", "./src/shared/portfolio/templates.ts", "./src/shared/portfolio/portfolio.css", "./src/backend/publishing/export-template/package-lock.json", "./public/assets/**/*", "./public/portfolio-motion.js", "./ASSET_CREDITS.md"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
};

export default config;
