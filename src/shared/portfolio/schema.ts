import { z } from "zod";

export const blockTypes = ["Hero", "Projects", "Text", "Experience", "Image", "Contact", "Education", "Skills", "Testimonials", "Gallery", "Links", "ProjectDetail", "Columns"] as const;
export const animations = ["none", "fade", "rise", "scale", "stagger"] as const;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const safeImage = z.string().max(1_500_000).refine((value) => !value || /^\/assets\/[a-z0-9/-]+\.(?:webp|jpe?g|png)$/.test(value) && !value.includes("..") || /^\/api\/assets\/[a-f0-9-]{36}$/.test(value) || /^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(value), "Use an uploaded image or a library image.");
const safeFont = z.string().refine((value) => !value || /^\/api\/assets\/[a-f0-9-]{36}$/.test(value) || /^\/assets\/uploads\/[a-f0-9-]{36}\.woff2$/.test(value), "Choose an uploaded WOFF2 font.");
const responsiveStyle = z.object({
  padding: z.number().min(8).max(160).optional(), fontSize: z.number().min(16).max(120).optional(),
  maxWidth: z.number().min(240).max(1440).optional(), columns: z.number().int().min(1).max(3).optional(),
  imageWidth: z.number().min(30).max(100).optional(), alignment: z.enum(["left", "center"]).optional(),
  hidden: z.boolean().optional(),
});
export const itemSchema = z.object({
  title: z.string().max(160), category: z.string().max(120), description: z.string().max(1200),
  image: safeImage, url: z.string().max(1000).refine((value) => !value || /^(?:https:\/\/|mailto:|#|\/)[^\s]*$/.test(value) && !value.startsWith("//"), "Use an HTTPS, email, or internal link."),
  pageId: z.string().max(100).optional(),
});
const sectionPropsSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  eyebrow: z.string().max(160), title: z.string().max(500), description: z.string().max(6000),
  image: safeImage, imageAlt: z.string().max(300), items: z.array(itemSchema).max(24),
  padding: z.number().min(16).max(160), maxWidth: z.number().min(480).max(1440),
  fontSize: z.number().min(24).max(120), imageWidth: z.number().min(30).max(100),
  alignment: z.enum(["left", "center"]), columns: z.number().int().min(1).max(3),
  animation: z.enum(animations), duration: z.number().min(0.15).max(1.5),
  background: z.union([z.literal(""), color]), hiddenOnMobile: z.boolean(),
  responsive: z.object({ tablet: responsiveStyle, mobile: responsiveStyle }).default({ tablet: {}, mobile: {} }),
  delay: z.number().min(0).max(1).default(0), easing: z.enum(["ease-out", "ease-in-out", "linear"]).default("ease-out"),
  trigger: z.enum(["view", "load"]).default("view"), hover: z.enum(["none", "lift", "zoom"]).default("none"),
  stagger: z.number().min(0).max(0.3).default(0.08),
  imageFit: z.enum(["cover", "contain"]).default("cover"), imageAspect: z.enum(["auto", "square", "landscape", "portrait"]).default("auto"),
  imageX: z.number().min(0).max(100).default(50), imageY: z.number().min(0).max(100).default(50),
});
export const columnSchema = z.object({ kind: z.enum(["Text", "Image", "Links"]), content: sectionPropsSchema });
export const blockPropsSchema = sectionPropsSchema.extend({ columnsContent: z.array(columnSchema).max(3).default([]) });
export const blockSchema = z.object({ type: z.enum(blockTypes), props: blockPropsSchema });
export const pageSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), name: z.string().min(1).max(80),
  slug: z.string().max(80).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
  description: z.string().max(300), blocks: z.array(blockSchema).max(40),
  title: z.string().max(120).default(""), socialImage: safeImage.default(""),
});
export const projectSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), revision: z.number().int().nonnegative(),
  name: z.string().min(1).max(100), template: z.enum(["studio", "developer", "editorial", "professional"]),
  profile: z.object({ name: z.string().min(1).max(100), role: z.string().max(160), email: z.string().email().or(z.literal("")), available: z.boolean() }),
  theme: z.object({ background: color, foreground: color, accent: color, font: z.enum(["sans", "serif", "mono", "custom"]), radius: z.number().min(0).max(32), footerCredit: z.boolean().default(true), customFont: safeFont.default("") }),
  pages: z.array(pageSchema).min(1).max(30),
  redirects: z.array(z.object({ from: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), toPageId: z.string().max(100) })).max(100).default([]),
  favicon: safeImage.default(""),
}).superRefine((project, context) => {
  if (project.pages.filter((page) => page.slug === "").length !== 1) context.addIssue({ code: "custom", path: ["pages"], message: "Choose exactly one home page." });
  for (const key of ["id", "slug"] as const) if (new Set(project.pages.map((page) => page[key])).size !== project.pages.length) context.addIssue({ code: "custom", path: ["pages"], message: `Page ${key}s must be unique.` });
  const ids = project.pages.flatMap((page) => page.blocks.flatMap((block) => [block.props.id, ...block.props.columnsContent.map((child) => child.content.id)]));
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["pages"], message: "Section IDs must be unique." });
  const pages = new Set(project.pages.map((page) => page.id));
  if (project.pages.some((page) => page.blocks.some((block) => [block.props, ...block.props.columnsContent.map((child) => child.content)].some((props) => props.items.some((item) => item.pageId && !pages.has(item.pageId)))))) context.addIssue({ code: "custom", path: ["pages"], message: "An internal link refers to a removed page." });
  if (project.redirects.some((redirect) => !pages.has(redirect.toPageId) || project.pages.some((page) => page.slug === redirect.from)) || new Set(project.redirects.map((redirect) => redirect.from)).size !== project.redirects.length) context.addIssue({ code: "custom", path: ["redirects"], message: "Redirects must be unique and point to a current page." });
});

export type Project = z.infer<typeof projectSchema>;
export type PortfolioPage = z.infer<typeof pageSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockProps = z.infer<typeof blockPropsSchema>;
export type BlockType = typeof blockTypes[number];
export type TemplateId = Project["template"];
export type ResponsiveStyle = z.infer<typeof responsiveStyle>;

export { templateMeta } from "./templates";

function defaultBlock(type: BlockType, id = crypto.randomUUID()): Block {
  return blockSchema.parse({ type, props: { id, eyebrow: type === "Hero" ? "INDEPENDENT DESIGNER & CREATIVE THINKER" : "A LITTLE MORE ABOUT ME", title: type === "Hero" ? "Good things start\nwith a little curiosity." : type === "Projects" ? "A selection of good things." : type === "Contact" ? "Have something\nin mind?" : type === "Experience" ? "The path so far." : type === "Education" ? "Always learning." : type === "Skills" ? "What I bring to the table." : type === "Testimonials" ? "In good company." : type === "Gallery" ? "A closer look." : type === "Links" ? "Find me elsewhere." : type === "ProjectDetail" ? "The thinking behind the work." : "A little about me.", description: type === "Hero" ? "I turn thoughtful ideas into meaningful digital experiences. Currently making things, asking questions, and looking for what’s next." : "A space for your story. Share what you do, what you care about, and what makes your work yours.", image: type === "Image" || type === "ProjectDetail" ? "/assets/studio.webp" : "", imageAlt: "A considered, sunlit interior", items: [], padding: type === "Hero" ? 88 : 64, maxWidth: 1120, fontSize: type === "Hero" ? 76 : 44, imageWidth: 100, alignment: "left", columns: 2, animation: "rise", duration: 0.6, background: "", hiddenOnMobile: false } });
}

export function newBlock(type: BlockType, id = crypto.randomUUID()): Block {
  const block = defaultBlock(type, id);
  if (type === "Columns") {
    block.props.title = "A little more to explore.";
    block.props.columnsContent = ["Text", "Image"].map((type) => {
      const nested = defaultBlock(type as "Text" | "Image");
      const { columnsContent: _children, ...props } = nested.props;
      return { kind: type as "Text" | "Image", content: props };
    });
  }
  return block;
}

export function createProject(template: TemplateId = "studio", id = crypto.randomUUID()): Project {
  const hero = newBlock("Hero");
  const projects = newBlock("Projects");
  projects.props.items = [
    { title: "A quieter kind of living", category: "BRAND STRATEGY · ART DIRECTION", description: "A fresh perspective on everyday spaces.", image: "/assets/interior.webp", url: "" },
    { title: "Objects with intention", category: "DIGITAL DESIGN · IDENTITY", description: "Making room for the things that matter.", image: "/assets/objects.webp", url: "" },
    { title: "Somewhere, slower", category: "WEB DESIGN · DEVELOPMENT", description: "An invitation to take the scenic route.", image: "/assets/architecture.webp", url: "" },
    { title: "A place to gather", category: "CREATIVE DIRECTION · EDITORIAL", description: "Small details. A lasting impression.", image: "/assets/studio.webp", url: "" },
  ];
  const about = newBlock("Text");
  about.props.title = "Thoughtful by nature.\nCurious by choice.";
  about.props.description = "Hi, I’m Alex. I’m an independent designer who believes the best work comes from paying attention. To people, to details, to the things others walk past.\n\nI work with good people to build identities, digital experiences, and things that make a difference. When I’m not at my desk, you’ll find me looking for a good coffee and a new perspective.";
  const contact = newBlock("Contact");
  contact.props.eyebrow = "LET’S MAKE SOMETHING GOOD";
  contact.props.description = "Open to good conversations and interesting collaborations.";
  const experience = newBlock("Experience");
  experience.props.items = [
    { title: "Independent designer", category: "2023 — NOW", description: "Partnering with ambitious teams on thoughtful brands and digital products.", image: "", url: "" },
    { title: "Product designer · Studio North", category: "2020 — 2023", description: "Designing useful, human experiences from the first sketch to the final detail.", image: "", url: "" },
  ];
  const project = projectSchema.parse({
    schemaVersion: 1, id, revision: 0, name: "My portfolio", template,
    profile: { name: "Alex Morgan", role: "Independent designer", email: "hello@example.com", available: true },
    theme: { background: "#f9f8f4", foreground: "#242720", accent: "#536542", font: "sans", radius: 4 },
    pages: [{ id: crypto.randomUUID(), name: "Work", slug: "", description: "Selected work and independent projects.", blocks: [hero, projects, contact] }, { id: crypto.randomUUID(), name: "About", slug: "about", description: "The person behind the work.", blocks: [about, experience] }],
  });
  if (template === "developer") {
    project.profile = { ...project.profile, name: "Jordan Lee", role: "Design-minded developer" };
    project.theme = { ...project.theme, background: "#171e1b", foreground: "#e6eedf", accent: "#c8ee9a", font: "mono", radius: 8 };
    hero.props.eyebrow = "DESIGN-MINDED DEVELOPER";
    hero.props.title = "Thoughtfully designed.\nCarefully built.";
    hero.props.description = "I’m Jordan, a developer turning complex problems into simple, useful experiences. Building for the web, with people in mind.";
    projects.props.title = "Things I’ve shipped.";
    projects.props.items = [
      { title: "A thoughtful component system", category: "OPEN SOURCE · REACT", description: "Accessible, considered components for people building useful things.", image: "", url: "" },
      { title: "A different perspective", category: "PRODUCT · DEVELOPMENT", description: "A small tool that makes an everyday task a little easier.", image: "", url: "" },
    ];
    about.props.title = "People first.\nCode second.";
    about.props.description = "I’m Jordan, a design-minded developer who cares about the details. I build useful things for the web, from a first sketch to a thoughtfully shipped product.\n\nI enjoy the space where clear thinking, good design, and careful engineering meet.";
    experience.props.items[0].title = "Independent developer";
    experience.props.items[1].title = "Frontend developer · Product team";
  } else if (template === "editorial") {
    project.profile = { ...project.profile, name: "Sam Rivera", role: "Photographer & visual storyteller" };
    project.theme = { ...project.theme, background: "#f3e9e3", foreground: "#442b27", accent: "#98412f", font: "serif", radius: 0 };
    hero.props.eyebrow = "PHOTOGRAPHY · PLACES · PEOPLE";
    hero.props.title = "The beauty\nin between.";
    hero.props.description = "I’m Sam. A photographer drawn to quiet moments, changing light, and the stories hiding in plain sight.";
    hero.props.fontSize = 96;
    about.props.description = "I’m Sam, a photographer drawn to quiet moments and changing light. I make photographs of places, people, and the stories hiding in plain sight.\n\nMy work starts with looking a little longer. There is usually something worth noticing.";
  } else if (template === "professional") {
    project.profile = { ...project.profile, name: "Taylor Brooks", role: "Strategy & independent consulting" };
    project.theme = { ...project.theme, background: "#eef1f7", foreground: "#1c304f", accent: "#345adb", font: "sans", radius: 12 };
    hero.props.eyebrow = "STRATEGY · PEOPLE · PROGRESS";
    hero.props.title = "Clear thinking.\nMeaningful progress.";
    hero.props.description = "I help ambitious teams find clarity, build momentum, and turn the right ideas into lasting results.";
    projects.props.title = "A few ways I’ve made a difference.";
    about.props.description = "I’m Taylor, an independent consultant helping teams find clarity and make meaningful progress. I work with people who want to build things thoughtfully and leave them better than they found them.\n\nMy approach combines clear strategy, careful listening, and a practical next step.";
    experience.props.items[0].title = "Independent strategy consultant";
    experience.props.items[1].title = "Strategy lead · Growth team";
  }
  return project;
}

export function duplicatePage(page: PortfolioPage, existingSlugs: string[]): PortfolioPage {
  let slug = `${page.slug || "home"}-copy`;
  let suffix = 2;
  while (existingSlugs.includes(slug)) slug = `${page.slug || "home"}-copy-${suffix++}`;
  const id = crypto.randomUUID();
  return { ...structuredClone(page), id, name: `${page.name.slice(0, 74)} copy`, slug, blocks: page.blocks.map((block) => ({ ...structuredClone(block), props: { ...structuredClone(block.props), id: crypto.randomUUID(), items: block.props.items.map((item) => item.pageId === page.id ? { ...item, pageId: id } : { ...item }), columnsContent: block.props.columnsContent.map((child) => ({ ...structuredClone(child), content: { ...structuredClone(child.content), id: crypto.randomUUID(), items: child.content.items.map((item) => item.pageId === page.id ? { ...item, pageId: id } : { ...item }) } })) } })) };
}
