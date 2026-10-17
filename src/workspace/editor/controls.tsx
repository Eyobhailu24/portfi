import type { ReactNode } from "react";
import { Slider } from "@/shared/components/ui/slider";

export function Field({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return <div className="editor-field"><span className="editor-field-label">{label}</span>{children}{note && <p className="editor-field-note">{note}</p>}</div>;
}
export function Range({ label, value, min, max, unit = "px", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <Field label={label}><div className="editor-range"><Slider aria-label={label} value={[value]} min={min} max={max} step={unit === "s" ? .05 : 1} onValueChange={([value]) => onChange(value)} /><output>{Math.round(value * 100) / 100}{unit}</output></div></Field>;
}
