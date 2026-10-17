"use client";

import { useState } from "react";
import type { BlockProps, Project, ResponsiveStyle } from "@/shared/portfolio/schema";
import { Field, Range } from "./controls";

export function ResponsiveControls({ props, update, preview }: { props: BlockProps; update: (patch: Partial<BlockProps>) => void; preview: (device: "desktop" | "tablet" | "mobile") => void }) {
  const [device, setDevice] = useState<"tablet" | "mobile">("mobile");
  const style = props.responsive[device];
  const inherited = device === "mobile" ? { ...props, ...props.responsive.tablet } : props;
  function patch(next: ResponsiveStyle) { update({ responsive: { ...props.responsive, [device]: { ...style, ...next } } }); }
  return <details className="editor-advanced"><summary>Device overrides <span>{Object.keys(style).length ? "Custom" : "Inherited"}</span></summary>
    <p className="editor-help">Tablet inherits desktop. Mobile inherits tablet. Reset a device to restore inheritance.</p>
    <div className="editor-segmented">{(["tablet", "mobile"] as const).map((item) => <button key={item} className={device === item ? "active" : ""} aria-pressed={device === item} onClick={() => { setDevice(item); preview(item); }}>{item === "tablet" ? "Tablet" : "Mobile"}</button>)}</div>
    <Range label={`${device} heading size`} value={style.fontSize ?? Math.min(inherited.fontSize, device === "mobile" ? 48 : 70)} min={16} max={120} onChange={(fontSize) => patch({ fontSize })} />
    <Range label={`${device} spacing`} value={style.padding ?? Math.min(inherited.padding, device === "mobile" ? 64 : 120)} min={8} max={160} onChange={(padding) => patch({ padding })} />
    <Range label={`${device} content width`} value={style.maxWidth ?? inherited.maxWidth} min={240} max={1440} onChange={(maxWidth) => patch({ maxWidth })} />
    <Range label={`${device} image width`} value={style.imageWidth ?? inherited.imageWidth} min={30} max={100} unit="%" onChange={(imageWidth) => patch({ imageWidth })} />
    <Field label="Columns"><select aria-label={`${device} columns`} className="editor-input" value={style.columns ?? (device === "mobile" ? 1 : inherited.columns)} onChange={(event) => patch({ columns: Number(event.target.value) })}>{[1, 2, 3].map((count) => <option key={count} value={count}>{count} {count === 1 ? "column" : "columns"}</option>)}</select></Field>
    <Field label="Alignment"><select aria-label={`${device} alignment`} className="editor-input" value={style.alignment ?? inherited.alignment} onChange={(event) => patch({ alignment: event.target.value as "left" | "center" })}><option value="left">Left</option><option value="center">Center</option></select></Field>
    <label className="editor-check"><input type="checkbox" checked={style.hidden ?? (device === "mobile" ? props.responsive.tablet.hidden ?? props.hiddenOnMobile : false)} onChange={(event) => patch({ hidden: event.target.checked })} /> Hide on {device}</label>
    <button className="editor-add-page" onClick={() => update({ responsive: { ...props.responsive, [device]: {} } })}>Reset {device} overrides</button>
  </details>;
}

export function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const components = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function ContrastFeedback({ theme }: { theme: Project["theme"] }) {
  const ratio = contrastRatio(theme.foreground, theme.background);
  return <p className="editor-help">Text/canvas contrast: <b>{ratio.toFixed(1)}:1</b>. {ratio >= 4.5 ? "Meets the normal-text AA contrast target." : "Increase contrast for normal-sized text."} Check image overlays and other color pairs separately.</p>;
}
