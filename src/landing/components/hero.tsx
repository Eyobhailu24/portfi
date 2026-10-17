"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, FileText, GripVertical, Layers3, Monitor, MousePointer2, PanelLeft, Plus } from "lucide-react";
import { TemplatePreview } from "@/shared/components/template-preview";
import { Reveal, useLandingMotion } from "../motion/landing-motion";

function HeroDemo() {
  const [name, setName] = useState("Alex Morgan");
  const [accent, setAccent] = useState("#536542");
  const [tab, setTab] = useState<"Content" | "Design">("Content");
  const { enabled } = useLandingMotion();

  return (
    <Reveal className="demo-reveal" delay={0.18} distance={32}>
      <div className="hero-demo" id="editor-preview">
        <div className="demo-toolbar">
          <span className="demo-project"><span className="demo-p">p.</span> My portfolio <ChevronDown size={12} /></span>
          <span className="demo-save"><Check size={12} /> Changes look good</span>
          <div><Monitor size={15} /><span className="demo-toolbar-divider" /><Link prefetch={false} href="/editor">Open the editor <ArrowUpRight size={13} /></Link></div>
        </div>
        <div className="demo-body">
          <aside className="demo-sidebar" aria-label="Try the portfolio editor">
            <div className="demo-tabs" role="tablist" aria-label="Preview controls">
              {(["Content", "Design"] as const).map((item) => (
                <button key={item} id={`demo-tab-${item}`} role="tab" aria-selected={tab === item}
                  aria-controls="demo-panel" tabIndex={tab === item ? 0 : -1} className={tab === item ? "active" : ""} onClick={() => setTab(item)}
                  onKeyDown={(event) => {
                    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? "Content" : event.key === "End" ? "Design" : tab === "Content" ? "Design" : "Content";
                    setTab(next);
                    document.getElementById(`demo-tab-${next}`)?.focus();
                  }}>{item}</button>
              ))}
            </div>
            <div className="demo-page-label"><span>YOUR PAGE</span><span>01</span></div>
            <div className="demo-section-row selected"><GripVertical size={13} /><PanelLeft size={14} /><span>Introduction</span><ChevronDown size={12} /></div>
            <div className="demo-field-area" id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`}>
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={tab} initial={enabled ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: enabled ? 0 : 1 }} transition={{ duration: enabled ? 0.16 : 0 }}>
                  {tab === "Content" ? <>
                    <label htmlFor="demo-name">Your name</label>
                    <input id="demo-name" value={name} maxLength={35} onChange={(event) => setName(event.target.value)} />
                    <span className="demo-label">What you do</span><div className="demo-faux-input">Independent designer</div>
                    <span className="demo-label">Your introduction</span><div className="demo-faux-text">Good things start with a little curiosity.</div>
                    <p className="demo-field-note">Go on. Try changing your name.</p>
                  </> : <>
                    <span className="demo-label">Make it feel like you</span><p className="demo-design-copy">A small change. A whole new mood.</p>
                    <div className="demo-swatches" role="group" aria-label="Portfolio accent color">
                      {[{ color: "#536542", name: "Olive" }, { color: "#2447e8", name: "Cobalt" }, { color: "#98412f", name: "Terracotta" }, { color: "#242720", name: "Charcoal" }].map((item) => (
                        <button key={item.color} aria-label={item.name} aria-pressed={accent === item.color} style={{ background: item.color }}
                          className={accent === item.color ? "active" : ""} onClick={() => setAccent(item.color)} />
                      ))}
                    </div>
                    <span className="demo-label">Typography</span><div className="demo-faux-input">A thoughtful sans serif <ChevronDown size={12} /></div>
                    <span className="demo-label">Room to breathe</span><div className="demo-spacing"><span /><span /><span /></div>
                  </>}
                </m.div>
              </AnimatePresence>
            </div>
            <div className="demo-section-row"><GripVertical size={13} /><Layers3 size={14} /><span>Selected work</span><Plus size={12} /></div>
            <div className="demo-section-row"><GripVertical size={13} /><FileText size={14} /><span>A little about me</span><Plus size={12} /></div>
            <Link prefetch={false} className="demo-add" href="/editor"><Plus size={13} /> Add a section</Link>
            <div className="demo-sidebar-bottom"><span className="tiny-dot" />A place for your next chapter.</div>
          </aside>
          <div className="demo-canvas">
            <TemplatePreview template="studio" name={name || "Your name"} accent={accent} />
            <span className="demo-cursor" aria-hidden="true"><MousePointer2 size={20} fill="#2447e8" /><span>You, making it yours</span></span>
          </div>
        </div>
        <div className="demo-footnote"><span><span className="tiny-dot" /> A real little preview. Try it above.</span><span>Your ideas. Your space. Your way.</span></div>
      </div>
      <span className="demo-edge-glow" aria-hidden="true" />
    </Reveal>
  );
}

export function Hero() {
  return (
    <section className="hero section-shell">
      <div className="hero-top">
        <Reveal className="hero-title">
          <span className="eyebrow"><span /> A PORTFOLIO BUILDER. WITH A LITTLE MORE SOUL.</span>
          <h1>Your work deserves<br />a <em>beautiful home.</em></h1>
          <span className="hero-title-rule" aria-hidden="true" />
        </Reveal>
        <Reveal className="hero-aside" delay={0.1}>
          <p>Make a portfolio that feels like you.<br />Thoughtful templates. Effortless editing.<br />And a little room to make it your own.</p>
          <Link prefetch={false} href="/editor" className="button button-blue">Create your portfolio <ArrowUpRight size={17} /></Link>
          <span className="hero-reassurance">Free to begin. Yours to keep.</span>
        </Reveal>
      </div>
      <HeroDemo />
      <Reveal className="hero-under" distance={10}><span>YOU BRING THE WORK. WE’LL BRING THE POSSIBILITIES.</span><a href="#templates">Find your starting point <ArrowDown size={14} /></a></Reveal>
    </section>
  );
}
