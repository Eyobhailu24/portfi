import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand${light ? " brand-light" : ""}`} href="/" aria-label="Portfi home"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M4 4h10a10 10 0 0 1 0 20H4V4Z" fill="currentColor"/><path d="M10 10h4a4 4 0 0 1 0 8h-4v-8Z" className="brand-cutout" fill={light ? "#10131a" : "#f7f6f2"}/><path d="M4 18h6v10H4z" fill="currentColor"/></svg><span>portfi<span className="brand-period">.</span></span></Link>;
}
