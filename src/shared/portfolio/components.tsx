import type { CSSProperties, ReactNode } from "react";
import type { Block, BlockProps, PortfolioPage, Project, ResponsiveStyle } from "./schema";
import { RichText } from "./rich-text";

export function PortfolioChrome({ project, pageSlug = "", linkPrefix = "", children }: { project: Project; pageSlug?: string; linkPrefix?: string; children: ReactNode }) {
  const style = { "--folio-bg": project.theme.background, "--folio-ink": project.theme.foreground, "--folio-accent": project.theme.accent, "--folio-radius": `${project.theme.radius}px`, ...(project.theme.font === "custom" && project.theme.customFont ? { fontFamily: `Portfi-${project.id}, Manrope, sans-serif` } : {}) } as CSSProperties;
  return <div className={`folio folio-${project.theme.font} template-${project.template}`} style={style}>
    {project.theme.font === "custom" && project.theme.customFont && <style>{`@font-face{font-family:Portfi-${project.id};src:url("${project.theme.customFont}") format("woff2");font-display:swap;}`}</style>}
    <header className="folio-nav">
      <a className="folio-wordmark" href={`${linkPrefix}/`}>{project.profile.name}<span>®</span></a>
      <nav aria-label="Portfolio navigation">{project.pages.map((page) => <a key={page.id} href={`${linkPrefix}/${page.slug}`} aria-current={page.slug === pageSlug ? "page" : undefined}>{page.name}</a>)}{project.profile.email && <a href={`mailto:${project.profile.email}`}>Say hello <span aria-hidden="true">↗</span></a>}</nav>
    </header>
    <main>{children}</main>
    <footer className="folio-footer"><span>© {new Date().getFullYear()} {project.profile.name}</span><span>{project.profile.role}</span>{project.theme.footerCredit && <span>Made with Portfi</span>}</footer>
  </div>;
}

function responsiveVariables(prefix: string, style: ResponsiveStyle) {
  return Object.fromEntries(Object.entries(style).filter(([key]) => key !== "hidden").map(([key, value]) => {
    const keys: Record<string, string> = { padding: "padding", maxWidth: "width", fontSize: "size", columns: "columns", imageWidth: "image-width", alignment: "align" };
    return [`--${prefix}-${keys[key]}`, typeof value === "number" && !["columns", "imageWidth"].includes(key) ? `${value}px` : key === "imageWidth" ? `${value}%` : value];
  }));
}

function SectionFrame({ props, type, children }: { props: BlockProps; type: Block["type"]; children: ReactNode }) {
  const style = {
    background: props.background || undefined, "--desktop-padding": `${props.padding}px`, "--desktop-width": `${props.maxWidth}px`,
    "--desktop-size": `${props.fontSize}px`, "--section-duration": `${props.duration}s`, "--section-delay": `${props.delay}s`, "--section-easing": props.easing,
    "--desktop-image-width": `${props.imageWidth}%`, "--desktop-columns": props.columns, "--desktop-align": props.alignment, "--stagger-delay": `${props.stagger}s`,
    ...responsiveVariables("tablet", props.responsive.tablet), ...responsiveVariables("mobile", props.responsive.mobile),
    "--image-fit": props.imageFit, "--image-position": `${props.imageX}% ${props.imageY}%`, "--image-aspect": { auto: "auto", square: "1", landscape: "1.5", portrait: ".75" }[props.imageAspect],
  } as CSSProperties;
  return <section id={props.id} className={`folio-section folio-section-${type.toLowerCase()} motion-${props.animation} hover-${props.hover}`} style={style}
    data-motion={props.animation} data-trigger={props.trigger} data-image-aspect={props.imageAspect} data-tablet-hidden={props.responsive.tablet.hidden || undefined}
    data-mobile-hidden={props.responsive.mobile.hidden ?? props.responsive.tablet.hidden ?? props.hiddenOnMobile ? "true" : undefined}
    data-tablet-align={props.responsive.tablet.alignment || props.alignment} data-mobile-align={props.responsive.mobile.alignment || props.responsive.tablet.alignment || props.alignment}>
    <div className={`folio-section-inner align-${props.alignment}`}>{children}</div>
  </section>;
}

export function PortfolioBlock({ block, email = "", linkPrefix = "", pages = [] }: { block: Block; email?: string; linkPrefix?: string; pages?: PortfolioPage[] }) {
  const p = block.props;
  const href = (item: BlockProps["items"][number]) => {
    const page = pages.find((page) => page.id === item.pageId);
    const url = page ? `/${page.slug}` : item.url;
    return url.startsWith("/") ? `${linkPrefix}${url}` : url || undefined;
  };
  const heading = <><span className="folio-eyebrow">{p.eyebrow}</span><h2>{p.title}</h2></>;
  return <SectionFrame props={p} type={block.type}>
    {block.type === "Hero" && <>
      <div className="folio-eyebrow"><span className="folio-dot" />{p.eyebrow}</div><h1 className="folio-hero-title">{p.title}</h1>
      <div className="folio-hero-bottom"><p><RichText text={p.description} /></p><a className="folio-round-arrow" href="#selected-work" aria-label="Explore selected work">↓</a></div>
    </>}
    {block.type === "Projects" && <>
      <div className="folio-section-heading" id="selected-work"><h2>{p.title}</h2><span>SELECTED WORK / {String(p.items.length).padStart(2, "0")}</span></div>
      <div className="folio-project-grid">{p.items.map((item, index) => <article className="folio-project" key={index} style={{ "--item-index": index } as CSSProperties}>
        {item.image ? <a className="folio-project-image" href={href(item)} aria-label={item.title}><PortfolioImage src={item.image} alt={item.title} loading="lazy" width="960" height="720" />{href(item) && <span aria-hidden="true">↗</span>}</a> : <a href={href(item)} className="folio-project-graphic"><span>{String(index + 1).padStart(2, "0")} / SELECTED PROJECT</span><b aria-hidden="true">{index % 2 ? "{ }" : "< / >"}</b></a>}
        <div className="folio-project-caption"><div><h3><a href={href(item)}>{item.title}</a></h3><p>{item.category}</p></div>{href(item) && <span aria-hidden="true">↗</span>}</div>
        {item.description && <p className="folio-project-description"><RichText text={item.description} /></p>}
      </article>)}</div>
    </>}
    {block.type === "Text" && <div className="folio-text-layout"><div>{heading}</div><p><RichText text={p.description} /></p></div>}
    {(block.type === "Experience" || block.type === "Education") && <>{heading}<div className="folio-experience">{p.items.map((item, index) => <article key={index}><span>{item.category}</span><div><h3>{item.title}</h3><p><RichText text={item.description} /></p></div></article>)}</div></>}
    {block.type === "Image" && <figure className="folio-image-block">{p.image ? <PortfolioImage src={p.image} alt={p.imageAlt} loading="lazy" width="1200" height="900" /> : <div className="folio-image-placeholder">Choose an image in the editor</div>}{p.description && <figcaption><RichText text={p.description} /></figcaption>}</figure>}
    {block.type === "Skills" && <>{heading}<p className="folio-section-copy"><RichText text={p.description} /></p><div className="folio-skills">{p.items.map((item, index) => <article key={index}><h3>{item.title}</h3>{item.category && <span>{item.category}</span>}{item.description && <p><RichText text={item.description} /></p>}</article>)}</div></>}
    {block.type === "Testimonials" && <>{heading}<div className="folio-quotes">{p.items.map((item, index) => <figure key={index}><blockquote><RichText text={item.description} /></blockquote><figcaption><b>{item.title}</b><span>{item.category}</span></figcaption></figure>)}</div></>}
    {block.type === "Gallery" && <>{heading}<p className="folio-section-copy"><RichText text={p.description} /></p><div className="folio-gallery">{p.items.map((item, index) => <figure key={index}>{item.image && <a href={href(item)}><PortfolioImage src={item.image} alt={item.description || item.title} width="960" height="720" loading="lazy" /></a>}<figcaption>{item.title}</figcaption></figure>)}</div></>}
    {block.type === "Links" && <>{heading}<p className="folio-section-copy"><RichText text={p.description} /></p><div className="folio-links">{p.items.map((item, index) => <a key={index} href={href(item)}>{item.title}<span aria-hidden="true">↗</span></a>)}</div></>}
    {block.type === "Columns" && <>{heading}<div className="folio-columns">{p.columnsContent.map((child) => <PortfolioBlock key={child.content.id} block={{ type: child.kind, props: { ...child.content, columnsContent: [] } }} email={email} pages={pages} linkPrefix={linkPrefix} />)}</div></>}
    {block.type === "ProjectDetail" && <article className="folio-case-study">{heading}<p className="folio-section-copy"><RichText text={p.description} /></p>{p.image && <PortfolioImage src={p.image} alt={p.imageAlt} width="1200" height="900" loading="lazy" />}<div className="folio-case-details">{p.items.map((item, index) => <section key={index}><span className="folio-eyebrow">{item.category}</span><h3>{item.title}</h3><p><RichText text={item.description} /></p></section>)}</div></article>}
    {block.type === "Contact" && <>{heading}<p><RichText text={p.description} /></p>{p.items.length ? <div className="folio-links">{p.items.map((item, index) => <a className="folio-contact-link" key={index} href={href(item)}>{item.title}<span aria-hidden="true">↗</span></a>)}</div> : email && <a className="folio-contact-link" href={`mailto:${email}`}>Let’s talk <span aria-hidden="true">↗</span></a>}</>}
  </SectionFrame>;
}

export function PortfolioDocument({ project, pageSlug = "", linkPrefix = "" }: { project: Project; pageSlug?: string; linkPrefix?: string }) {
  const page = project.pages.find((page) => page.slug === pageSlug) || project.pages[0];
  return <PortfolioChrome project={project} pageSlug={page.slug} linkPrefix={linkPrefix}>{page.blocks.map((block) => <PortfolioBlock block={block} pages={project.pages} email={project.profile.email} linkPrefix={linkPrefix} key={block.props.id} />)}</PortfolioChrome>;
}

function PortfolioImage(props: { src: string; alt: string; width: string | number; height: string | number; loading: "lazy" }) {
  const uploaded = /^\/api\/assets\/[a-f0-9-]{36}$/.test(props.src);
  const exported = /^\/assets\/uploads\/[a-f0-9-]{36}\.(webp|jpg|png)$/.test(props.src);
  if (!uploaded && !exported) return <img {...props}/>;
  const variant = (width: number) => uploaded ? `${props.src}?width=${width}` : props.src.replace(/\.(webp|jpg|png)$/, `-${width}.webp`);
  return <picture><source media="(max-width: 640px)" srcSet={variant(640)} type="image/webp"/><source media="(max-width: 1000px)" srcSet={variant(960)} type="image/webp"/><img {...props}/></picture>;
}
