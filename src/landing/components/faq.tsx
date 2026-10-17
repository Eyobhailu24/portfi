"use client";

import { useId, useState } from "react";
import * as m from "motion/react-m";
import { Plus } from "lucide-react";
import { Reveal, useLandingMotion } from "../motion/landing-motion";

const questions = [
  { q: "Do I need to know how to code?", a: "No. Choose a template, add your work, and adjust the design with simple controls. You can drag sections into order, change colors and typography, and preview different screen sizes." },
  { q: "Is this only for designers or developers?", a: "Portfi is for anyone with a story and a body of work: designers, developers, photographers, consultants, job seekers, and other professionals. Start with the template that feels closest to you." },
  { q: "Where does my portfolio live?", a: "You can download your portfolio now, push its source to your own GitHub repository, and import it into your own Vercel account. Direct account connections and in-app deployment are being built. Hosting and domain costs are managed by your providers." },
  { q: "What happens after the free Creator month?", a: "At launch, the plan is to move you to Free unless you choose a paid plan. Your work will be retained, and already-deployed websites will keep running. Paid features and extra projects will remain saved until you upgrade or make a Free-compatible copy. Trial activation is still being built." },
  { q: "Can I take the code with me?", a: "Yes. The editor exports a standalone Next.js project with your pages, portfolio components, styles, and images. Changes made manually in your repository do not sync back into the visual editor." },
];

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { enabled } = useLandingMotion();
  return (
    <Reveal as="article" className={`faq-item${open ? " is-open" : ""}`} delay={index * 0.04} distance={12}>
      <h3><button id={`${id}-question`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={() => setOpen(!open)}>
        {question}<Plus size={18} aria-hidden="true" />
      </button></h3>
      <m.div id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} className="faq-answer"
        aria-hidden={!open} inert={!open} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: enabled ? 0.28 : 0 }}><p>{answer}</p></m.div>
    </Reveal>
  );
}

export function Faq() {
  return (
    <section className="faq-section section-shell" id="faq">
      <Reveal><span className="eyebrow">A FEW GOOD QUESTIONS</span><h2>Before you<br /><em>make yourself at home.</em></h2></Reveal>
      <div className="faq-list">{questions.map((item, index) => <FaqItem key={item.q} question={item.q} answer={item.a} index={index} />)}</div>
    </section>
  );
}
