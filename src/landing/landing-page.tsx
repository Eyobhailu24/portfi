import { LandingMotion, ScrollProgress } from "./motion/landing-motion";
import { SiteHeader } from "./components/site-header";
import { Hero } from "./components/hero";
import { Audience, HowItWorks, Ownership } from "./components/product-story";
import { TemplateGallery } from "./components/template-gallery";
import { MotionPlayground } from "./components/motion-playground";
import { Pricing } from "./components/pricing";
import { Faq } from "./components/faq";
import { FinalCta, SiteFooter } from "./components/site-footer";

export function LandingPage() {
  return (
    <LandingMotion>
      <ScrollProgress />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <Audience />
        <TemplateGallery />
        <HowItWorks />
        <MotionPlayground />
        <Ownership />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </LandingMotion>
  );
}
