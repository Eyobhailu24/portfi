"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Play } from "lucide-react";
import { Reveal, landingEase, useLandingMotion } from "../motion/landing-motion";

const presets = [
  { id: "rise", name: "Rise", label: "Soft rise" },
  { id: "fade", name: "Fade", label: "Gentle fade" },
  { id: "scale", name: "Scale", label: "Considered scale" },
] as const;

export function MotionPlayground() {
  const [preset, setPreset] = useState<(typeof presets)[number]>(presets[0]);
  const [replay, setReplay] = useState(0);
  const { enabled } = useLandingMotion();
  return (
    <div className="section-shell">
      <Reveal as="section" className="motion-section" id="motion">
        <div className="motion-copy">
          <span className="eyebrow light"><span /> A LITTLE MOVEMENT. A LOT OF CHARACTER.</span>
          <h2>Make a lasting<br /><em>first impression.</em></h2>
          <p>A quiet entrance. A playful hover. That just-right transition. Give your work a little life, with motion that feels considered.</p>
          <div className="motion-presets" role="group" aria-label="Try animation presets">
            {presets.map((item) => (
              <button key={item.id} className={preset.id === item.id ? "active" : ""} aria-pressed={preset.id === item.id}
                onClick={() => { setPreset(item); setReplay((value) => value + 1); }}>
                <span className={`preset-icon preset-${item.id}`} aria-hidden="true" />{item.name}
              </button>
            ))}
          </div>
          <button className="motion-replay" onClick={() => setReplay((value) => value + 1)} disabled={!enabled}>
            <Play size={13} fill="currentColor" /> {enabled ? "Replay animation" : "Motion is paused"}
          </button>
        </div>
        <div className="motion-stage">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={`${preset.id}-${replay}`} className="motion-art"
              initial={enabled ? { opacity: 0, y: preset.id === "rise" ? 30 : 0, scale: preset.id === "scale" ? 0.88 : 1, rotate: -3 } : false}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: -3 }} exit={{ opacity: enabled ? 0 : 1 }}
              transition={{ duration: enabled ? 0.6 : 0, ease: landingEase }}>
              <img src="/assets/studio.webp" alt="A sunlit interior used to demonstrate portfolio animation" width="560" height="600" loading="lazy" />
              <div className="motion-art-label"><span>THE ART OF<br />PAYING ATTENTION.</span><span>01 — 04</span></div>
            </m.div>
          </AnimatePresence>
          <div className="motion-control-label" aria-live="polite"><span className="tiny-dot" /> {preset.label}<span>{enabled ? "0.6s · ease out" : "Reduced motion"}</span></div>
          <span className="motion-orbit orbit-one" aria-hidden="true" /><span className="motion-orbit orbit-two" aria-hidden="true" />
        </div>
      </Reveal>
    </div>
  );
}
