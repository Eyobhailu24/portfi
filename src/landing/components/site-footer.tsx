import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { Reveal } from "../motion/landing-motion";

export function FinalCta() {
  return (
    <Reveal as="section" className="final-cta section-shell">
      <span className="eyebrow">YOUR NEXT CHAPTER STARTS WITH A LITTLE SPACE</span>
      <h2>Go on.<br />Make it <em>yours.</em><span className="cta-spark" aria-hidden="true">✳</span></h2>
      <Link prefetch={false} className="button button-blue" href="/editor">Create your portfolio <ArrowUpRight size={18} /></Link>
      <span className="hero-reassurance">Good work deserves to be seen.</span>
    </Reveal>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer section-shell">
      <div><Brand /><p>A thoughtful home for your work.</p></div>
      <nav aria-label="Footer navigation"><a href="#templates">Templates</a><a href="#how-it-works">How it works</a><Link prefetch={false} href="/dashboard">Your workspace</Link><a href="#faq">Questions?</a></nav>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Portfi</span><span>Made for independent minds. <span className="footer-spark" aria-hidden="true">✳</span></span><a href="#main-content">Back to the top ↑</a></div>
    </footer>
  );
}
