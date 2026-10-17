import Link from "next/link";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { plans } from "@/shared/plans/plans";
import { Reveal } from "../motion/landing-motion";

export function Pricing() {
  return (
    <section className="pricing-section section-shell" id="pricing">
      <Reveal className="section-heading">
        <div><span className="eyebrow">ROOM FOR WHAT’S NEXT</span><h2>Start small.<br /><em>Grow into your own.</em></h2></div>
        <div><p>At launch, your first month is on Creator.<br />No card. No commitment.<br />A little time to find your feet.</p><span className="pricing-launch-note">The plan below is our launch offering. Pricing is being finalized.</span></div>
      </Reveal>
      <div className="pricing-grid">
        {plans.map((plan, index) => (
          <Reveal as="article" key={plan.id} delay={index * 0.08} className={`pricing-card ${plan.id === "creator" ? "featured" : ""}`}>
            <div className="plan-eyebrow">{plan.id === "creator" ? <><Sparkles size={13} /> YOUR FIRST MONTH, ON US</> : plan.id === "free" ? "ALWAYS A PLACE TO START" : "FOR YOUR NEXT CHAPTER"}</div>
            <h3>{plan.name}</h3><p>{plan.description}</p>
            <div className="plan-price">{plan.id === "free" ? <>Free<span>to begin. Always.</span></> : plan.id === "creator" ? <>1 month free<span>then choose what’s right for you.</span></> : <>More possibility<span>paid plan · coming at launch.</span></>}</div>
            <Link prefetch={false} className={`button ${plan.id === "creator" ? "button-blue" : "button-outline"}`} href="/editor">{plan.id === "free" ? "Start for free" : plan.id === "creator" ? "Explore the editor" : "See what’s possible"}<ArrowUpRight size={15} /></Link>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
          </Reveal>
        ))}
      </div>
      <p className="pricing-footnote">Planned for launch: your trial ends on Free unless you choose a paid plan. Your work stays saved, and existing deployments stay yours. Vercel and domain costs are separate.</p>
    </section>
  );
}
