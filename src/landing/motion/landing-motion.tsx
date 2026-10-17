"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LazyMotion, MotionConfig, useInView, useReducedMotion, useScroll } from "motion/react";
import * as m from "motion/react-m";

const loadFeatures = () => import("./features").then((module) => module.default);
const MotionContext = createContext({ enabled: false, paused: false, reduced: false, toggle: () => {} });
export const useLandingMotion = () => useContext(MotionContext);
export const landingEase = [0.22, 1, 0.36, 1] as const;

export function LandingMotion({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try { setPaused(localStorage.getItem("portfi:landing:motion") === "paused"); } catch { /* Storage may be unavailable. */ }
    setReady(true);
  }, []);

  function toggle() {
    setPaused((previous) => {
      const next = !previous;
      try { localStorage.setItem("portfi:landing:motion", next ? "paused" : "playing"); } catch { /* The control still works without persistence. */ }
      return next;
    });
  }

  const enabled = ready && !reducedMotion && !paused;
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={enabled ? "user" : "always"} transition={{ duration: 0.65, ease: landingEase }}>
        <MotionContext.Provider value={{ enabled, paused, reduced: Boolean(reducedMotion), toggle }}>
          <div className="landing-site" data-motion={enabled ? "on" : "off"}>{children}</div>
        </MotionContext.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

// Server-rendered content stays visible before JavaScript loads. Reveals run once
// when a section enters the viewport; no scroll listeners update React state.
export function Reveal({ children, className, id, delay = 0, distance = 22, as = "div" }: {
  children: ReactNode; className?: string; id?: string; delay?: number; distance?: number;
  as?: "div" | "section" | "article";
}) {
  const { enabled } = useLandingMotion();
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.12, margin: "0px 0px -24px 0px" });
  const Element = as === "section" ? m.section : as === "article" ? m.article : m.div;

  return (
    <Element ref={(node: HTMLElement | null) => { ref.current = node; }} id={id} className={className}
      initial={false}
      animate={enabled && inView ? { opacity: [0, 1], y: [distance, 0] } : { opacity: 1, y: 0 }}
      transition={{ duration: enabled ? 0.7 : 0, delay: enabled ? delay : 0, ease: landingEase }}>
      {children}
    </Element>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const { enabled } = useLandingMotion();
  return enabled ? <m.div className="reading-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" /> : null;
}
