import Link from "next/link";
import { ArrowUpRight, Check, Code2, Download, Github, Globe2, Layers3, WandSparkles } from "lucide-react";
import { Reveal } from "../motion/landing-motion";

export function Audience() {
  return (
    <Reveal as="section" className="audience-strip section-shell" distance={12}>
      <p>For the many<br /><b>ways you work.</b></p>
      <div>{["Designers", "Developers", "Photographers", "Independent minds"].map((audience, index) => (
        <span className="audience-item" key={audience}>{index > 0 && <span className="audience-star" aria-hidden="true">✳</span>}{audience}</span>
      ))}</div>
    </Reveal>
  );
}

const steps = [
  { title: "Find your kind of canvas.", description: "Pick a template that speaks your language. We’ve taken care of the layout so you can focus on your work.", Icon: Layers3 },
  { title: "Make every detail yours.", description: "Add your story. Move things around. Find your colors. See every change come to life beside you.", Icon: WandSparkles },
  { title: "Put your work out there.", description: "Download your portfolio’s code. Push it to your GitHub, then import it into Vercel. Connected publishing is on the way.", Icon: Globe2 },
];

export function HowItWorks() {
  return (
    <section className="how-section section-shell" id="how-it-works">
      <Reveal className="how-intro">
        <span className="eyebrow">LESS SETUP. MORE SHOWING UP.</span>
        <h2>From “one day”<br />to <em>“here it is.”</em></h2>
        <p>You don’t need to know how to code.<br />You just need somewhere to start.</p>
        <Link prefetch={false} href="/editor" className="text-link">Let’s make something <ArrowUpRight size={16} /></Link>
      </Reveal>
      <div className="how-steps">
        {steps.map((step, index) => <Reveal as="article" key={step.title} delay={index * 0.07}>
          <span className="step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><step.Icon size={23} strokeWidth={1.3} />
        </Reveal>)}
      </div>
    </section>
  );
}

export function Ownership() {
  return (
    <section className="ownership-section section-shell">
      <Reveal className="ownership-visual">
        <Reveal className="ownership-file" delay={0.12}><Code2 size={27} strokeWidth={1.3} /><span>your-portfolio<span>.tsx</span></span><Check size={16} /></Reveal>
        <div className="ownership-connector" />
        <div className="ownership-destinations"><span><Github size={23} /> Your GitHub</span><span><svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="m12 3 11 19H1Z" fill="currentColor" /></svg> Your Vercel</span></div>
        <span className="ownership-note">GOOD WORK SHOULD COME WITH POSSIBILITIES.</span>
      </Reveal>
      <Reveal delay={0.1}>
        <span className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</span>
        <h2>Made with Portfi.<br /><em>Owned by you.</em></h2>
        <p>Your portfolio lives in your accounts. Download the source, keep your code, and take your work wherever life takes you.</p>
        <span className="ownership-status"><Download size={13} /> Source export available now</span>
        <Link prefetch={false} href="/editor" className="text-link">Make yourself at home <ArrowUpRight size={16} /></Link>
      </Reveal>
    </section>
  );
}
