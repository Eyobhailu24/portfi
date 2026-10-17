"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, Pause, Play, X } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { useLandingMotion } from "../motion/landing-motion";

const navigation = [
  { href: "#templates", title: "Templates" },
  { href: "#how-it-works", title: "How it works" },
  { href: "#motion", title: "Made to move" },
  { href: "#pricing", title: "Plans" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { paused, reduced, toggle } = useLandingMotion();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return (
    <header className="site-header">
      <div className="site-nav">
        <Brand />
        <nav id="landing-navigation" className={`nav-links${open ? " open" : ""}`} aria-label="Main navigation">
          {navigation.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.title}</a>)}
        </nav>
        <div className="nav-actions">
          <button className="motion-toggle" onClick={toggle} disabled={reduced} aria-pressed={paused || reduced}
            aria-label={reduced ? "Animations disabled by your device preference" : paused ? "Turn on animations" : "Pause animations"}
            title={reduced ? "Reduced motion is enabled on your device" : paused ? "Turn on animations" : "Pause animations"}>
            {paused || reduced ? <Play size={13} /> : <Pause size={13} />}<span>Motion</span>
          </button>
          <Link prefetch={false} className="nav-login" href="/login">Log in</Link>
          <Link prefetch={false} className="button button-ink button-small" href="/editor">Start creating <ArrowUpRight size={14} /></Link>
          <button className="menu-button icon-button" aria-label={open ? "Close navigation" : "Open navigation"}
            aria-controls="landing-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
