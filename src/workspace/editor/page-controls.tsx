"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Home, Plus, Trash2 } from "lucide-react";
import { duplicatePage, newBlock, pageSchema, type PortfolioPage, type Project } from "@/shared/portfolio/schema";
import { makeHomePage, removePage, renamePage } from "@/shared/portfolio/pages";
import { Dialog } from "@/shared/components/dialog";
import { Field } from "./controls";

export function PageControls({ project, pageId, change, select, notify, openMedia }: { project: Project; pageId: string; change: (project: Project) => void; select: (id: string) => void; notify: (message: string) => void; openMedia: (onSelect: (path: string) => void) => void }) {
  const page = project.pages.find((page) => page.id === pageId)!;
  const [slug, setSlug] = useState(page.slug);
  const [removing, setRemoving] = useState(false);
  useEffect(() => setSlug(page.slug), [page.id, page.slug]);
  function patch(value: Partial<PortfolioPage>) { change({ ...project, pages: project.pages.map((item) => item.id === pageId ? { ...item, ...value } : item) }); }
  function move(from: number, to: number) { const pages = [...project.pages]; const [item] = pages.splice(from, 1); pages.splice(to, 0, item); change({ ...project, pages }); }
  function commitSlug() { if (slug === page.slug) return; try { change(renamePage(project, page.id, slug)); } catch (error) { notify((error as Error).message); setSlug(page.slug); } }
  return <>
    <div className="panel-section-heading"><span>YOUR PAGES</span><span>{project.pages.length} / 30</span></div>
    <div className="editor-pages">{project.pages.map((item, index) => <div className={pageId === item.id ? "active" : ""} key={item.id}>
      <button onClick={() => select(item.id)}><span>{item.name}<small>/{item.slug}</small></span>{!item.slug && <Home size={12} />}</button>
      <div className="page-order-buttons"><button className="icon-button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={12} /></button><button className="icon-button" aria-label={`Move ${item.name} down`} disabled={index === project.pages.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={12} /></button><button className="icon-button" aria-label={`Duplicate ${item.name}`} disabled={project.pages.length >= 30} onClick={() => { const copy = duplicatePage(item, project.pages.map((page) => page.slug)); change({ ...project, pages: [...project.pages, copy] }); select(copy.id); }}><Copy size={12} /></button></div>
    </div>)}</div>
    <button className="editor-add-page" disabled={project.pages.length >= 30} onClick={() => { let n = project.pages.length + 1; while (project.pages.some((page) => page.slug === `page-${n}`)) n++; const page = pageSchema.parse({ id: crypto.randomUUID(), name: `Page ${n}`, slug: `page-${n}`, description: "", blocks: [newBlock("Text")] }); change({ ...project, pages: [...project.pages, page] }); select(page.id); }}><Plus size={13} /> Add a page</button>
    <div className="panel-divider" /><div className="panel-section-heading"><span>PAGE SETTINGS</span></div>
    <Field label="Page name"><input aria-label="Page name" className="editor-input" value={page.name} maxLength={80} onChange={(event) => patch({ name: event.target.value })} /></Field>
    <Field label="Page URL" note={page.slug ? "Links to this page stay connected when its URL changes. Old URLs redirect on Vercel." : "This is the home page."}><div className="editor-slug"><span>/</span><input aria-label="Page URL" value={slug} disabled={!page.slug} maxLength={80} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, ""))} onBlur={commitSlug} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></div></Field>
    {page.slug && <button className="editor-add-page" onClick={() => change(makeHomePage(project, page.id))}><Home size={13} /> Make this the home page</button>}
    <Field label="Search title"><input aria-label="Page search title" className="editor-input" value={page.title} maxLength={120} placeholder={`${page.name} — ${project.profile.name}`} onChange={(event) => patch({ title: event.target.value })} /></Field>
    <Field label="Search description"><textarea aria-label="Page search description" className="editor-input" value={page.description} rows={3} maxLength={300} onChange={(event) => patch({ description: event.target.value })} /></Field>
    <Field label="Social sharing image">{page.socialImage && <img src={page.socialImage} alt="Social preview" className="editor-social-image" />}<button className="editor-add-page" onClick={() => openMedia((path) => patch({ socialImage: path }))}>Choose from your library</button>{page.socialImage && <button className="editor-danger-link" onClick={() => patch({ socialImage: "" })}>Remove sharing image</button>}</Field>
    <Field label="Site icon">{project.favicon && <img src={project.favicon} width="32" height="32" alt="Site icon" />}<button className="editor-add-page" onClick={() => openMedia((path) => change({ ...project, favicon: path }))}>Choose site icon</button></Field>
    {page.slug && <button className="editor-danger-link" onClick={() => setRemoving(true)}><Trash2 size={12} /> Remove this page</button>}
    <Dialog open={removing} onOpenChange={setRemoving} title="Remove this page?" description="Links to this page will be cleared. You can undo this change in the editor."><div className="dialog-footer"><button className="button button-outline" onClick={() => setRemoving(false)}>Keep it</button><button className="button button-ink" onClick={() => { const next = removePage(project, page.id); change(next); select(next.pages[0].id); setRemoving(false); }}>Remove page</button></div></Dialog>
  </>;
}
