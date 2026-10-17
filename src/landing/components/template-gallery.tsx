"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUpRight } from "lucide-react";
import { templateMeta } from "@/shared/portfolio/templates";
import { TemplatePreview } from "@/shared/components/template-preview";
import { Reveal, useLandingMotion } from "../motion/landing-motion";

export function TemplateGallery() {
  const [filter, setFilter] = useState("All styles");
  const { enabled } = useLandingMotion();
  const templates = templateMeta.filter((template) => filter === "All styles" || template.category === filter);

  return (
    <section className="template-section section-shell" id="templates">
      <Reveal className="section-heading">
        <div><span className="eyebrow">A HEAD START THAT FEELS LIKE YOU</span><h2>A starting point.<br /><em>Never a limitation.</em></h2></div>
        <p>Choose a little structure.<br />Bring a lot of yourself.<br />Every detail is yours to change.</p>
      </Reveal>
      <Reveal className="template-filters">
        <div role="group" aria-label="Filter templates">
          {["All styles", "Creative", "Developer", "Professional"].map((item) => (
            <button className={filter === item ? "active" : ""} key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <span aria-live="polite">{templates.length.toString().padStart(2, "0")} TEMPLATES. YOUR POSSIBILITIES.</span>
      </Reveal>
      <AnimatePresence mode="wait" initial={false}>
        <m.div className="template-grid" key={filter} initial={enabled ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }} exit={{ opacity: enabled ? 0 : 1, y: enabled ? -5 : 0 }} transition={{ duration: enabled ? 0.2 : 0 }}>
          {templates.map((template, index) => (
            <Reveal key={template.id} className="template-card" delay={index % 2 * 0.08}>
              <Link prefetch={false} href={`/editor?template=${template.id}`}>
                <div className="template-card-art" style={{ backgroundColor: template.color }}>
                  <div className="template-card-paper"><TemplatePreview template={template.id} /></div>
                  <span className="template-use">Make this yours <ArrowUpRight size={16} /></span>
                </div>
                <div className="template-card-caption"><div><h3>{template.name}</h3><p>{template.description}</p></div><span>{template.label}</span><ArrowUpRight size={20} /></div>
              </Link>
            </Reveal>
          ))}
        </m.div>
      </AnimatePresence>
      <p className="template-fine-print">Illustrative portfolios, built with Portfi. Your story goes here.</p>
    </section>
  );
}
