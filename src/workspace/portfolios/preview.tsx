"use client";

import Link from "next/link";
import Script from "next/script";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PortfolioDocument } from "@/shared/portfolio/components";
import { api, json } from "@/workspace/api/client";
import type { Project } from "@/shared/portfolio/schema";
import { Brand } from "@/shared/components/brand";

export function PortfolioPreview({ id, slug }: { id: string; slug: string }) {
  const query = useQuery({ queryKey: ["project", id], queryFn: async () => json<{ project: Project }>(await api.api.projects[":id"].$get({ param: { id } })), staleTime: 0 });
  if (query.isPending) return <main id="main-content" className="loading-screen"><Brand/><span className="loading-spinner"/><p>Your work, ready for its close-up…</p></main>;
  if (query.isError) return <main id="main-content" className="loading-screen"><Brand/><p>{query.error.message}</p><Link href="/dashboard" className="button button-blue">Open your workspace</Link></main>;
  const project = query.data.project;
  if (!project.pages.some((page) => page.slug === slug)) return <main id="main-content" className="loading-screen"><h1>That page isn’t here.</h1><Link href={`/preview/${id}`} className="text-link">Back to your portfolio</Link></main>;
  return <div id="main-content"><div className="portfolio-preview-bar"><Link href={`/editor/${id}`}><ArrowLeft size={13}/> Back to editing</Link><span>PORTFOLIO PREVIEW</span><button onClick={() => window.dispatchEvent(new Event("portfi:replay"))}>Replay motion</button><Link href={`/editor/${id}`}>Make it yours <ArrowUpRight size={13}/></Link></div><PortfolioDocument project={project} pageSlug={slug} linkPrefix={`/preview/${id}`}/><Script src="/portfolio-motion.js" strategy="afterInteractive"/></div>;
}
