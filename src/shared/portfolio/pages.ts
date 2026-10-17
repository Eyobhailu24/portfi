import type { Project } from "./schema";

function bindLinks(project: Project): Project {
  const bind = (items: Project["pages"][number]["blocks"][number]["props"]["items"]) => items.map((item) => ({ ...item, pageId: item.pageId || project.pages.find((target) => item.url === `/${target.slug}`)?.id }));
  return { ...project, pages: project.pages.map((page) => ({ ...page, blocks: page.blocks.map((block) => ({ ...block, props: { ...block.props, items: bind(block.props.items), columnsContent: block.props.columnsContent.map((child) => ({ ...child, content: { ...child.content, items: bind(child.content.items) } })) } })) })) };
}

export function renamePage(project: Project, id: string, slug: string): Project {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Use lowercase words separated by single hyphens for the page URL.");
  const bound = bindLinks(project);
  const page = bound.pages.find((item) => item.id === id);
  if (!page || page.slug === slug) return bound;
  if (bound.pages.some((item) => item.id !== id && item.slug === slug)) throw new Error("Another page already uses this URL.");
  const redirects = bound.redirects.filter((redirect) => redirect.from !== slug && redirect.from !== page.slug);
  if (page.slug && redirects.length < 100) redirects.push({ from: page.slug, toPageId: id });
  return { ...bound, redirects, pages: bound.pages.map((item) => item.id === id ? { ...item, slug } : item) };
}

export function makeHomePage(project: Project, id: string): Project {
  const bound = bindLinks(project);
  const old = bound.pages.find((page) => !page.slug)!;
  const next = bound.pages.find((page) => page.id === id);
  if (!next || next.id === old.id) return project;
  const base = old.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
  let slug = base; let index = 2;
  while (bound.pages.some((page) => page.id !== id && page.id !== old.id && page.slug === slug)) slug = `${base}-${index++}`;
  return { ...bound, redirects: [...bound.redirects.filter((redirect) => redirect.from !== next.slug && redirect.from !== slug), { from: next.slug, toPageId: id }].slice(-100), pages: bound.pages.map((page) => page.id === id ? { ...page, slug: "" } : page.id === old.id ? { ...page, slug } : page) };
}

export function removePage(project: Project, id: string): Project {
  const bound = bindLinks(project);
  return { ...bound, redirects: bound.redirects.filter((redirect) => redirect.toPageId !== id), pages: bound.pages.filter((page) => page.id !== id).map((page) => ({ ...page, blocks: page.blocks.map((block) => ({ ...block, props: { ...block.props, items: block.props.items.map((item) => item.pageId === id ? { ...item, pageId: undefined, url: "" } : item), columnsContent: block.props.columnsContent.map((child) => ({ ...child, content: { ...child.content, items: child.content.items.map((item) => item.pageId === id ? { ...item, pageId: undefined, url: "" } : item) } })) } })) })) };
}
