"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Save, Trash2, Upload } from "lucide-react";
import { blockTypes, newBlock, type Block, type BlockProps, type Project } from "@/shared/portfolio/schema";
import { api, json } from "@/workspace/api/client";
import { useUploadImage } from "@/workspace/api/workspace";
import { blockLabels, useEditor } from "./config";
import { Field, Range } from "./controls";
import { PageControls } from "./page-controls";
import { ContrastFeedback, ResponsiveControls } from "./responsive-controls";
import { MediaLibrary } from "./media-library";
import { FontControls } from "./font-controls";
import { ThemeLibrary } from "./theme-library";

type Props = { tab: "content" | "design" | "motion" | "pages"; project: Project; change: (next: Project | ((project: Project) => Project), group?: string) => void; pageId: string; setPageId: (id: string) => void; onNotice: (message: string) => void; onSelect: () => void; onViewport: (device: "desktop" | "tablet" | "mobile") => void };
const itemTypes = ["Projects", "Experience", "Education", "Skills", "Testimonials", "Gallery", "Links", "Contact", "ProjectDetail"];

export function EditorPanels({ tab, project, change, pageId, setPageId, onNotice, onSelect, onViewport }: Props) {
  const content = useEditor((state) => state.appState.data.content);
  const selectedItem = useEditor((state) => state.selectedItem);
  const dispatch = useEditor((state) => state.dispatch);
  const getSelector = useEditor((state) => state.getSelectorForId);
  const latest = useRef(content); latest.current = content;
  const selected = selectedItem as Block | null;
  const selectedIndex = selected ? content.findIndex((block) => block.props.id === selected.props.id) : -1;
  const dragged = useRef<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [media, setMedia] = useState<{ choose: (path: string, name: string) => void } | null>(null);
  const upload = useUploadImage();
  const library = useQuery({ queryKey: ["sections"], queryFn: async () => json<{ sections: { id: string; name: string; block: Block }[] }>(await api.api.sections.$get()), enabled: tab === "content" });
  const saveSection = useMutation({ mutationFn: async () => json(await api.api.sections.$post({ json: { name: selected!.props.title.slice(0, 80) || blockLabels[selected!.type], block: selected! } })), onSuccess: () => { void library.refetch(); onNotice("Section saved to your library."); }, onError: (error) => onNotice(error.message) });
  const deleteSection = useMutation({ mutationFn: async (id: string) => json(await api.api.sections[":id"].$delete({ param: { id } })), onSuccess: () => { void library.refetch(); } });

  function update(patch: Partial<BlockProps>, id = selected?.props.id) {
    if (!id) return;
    const selector = getSelector(id);
    const current = latest.current.find((block) => block.props.id === id);
    if (selector && current) dispatch({ type: "replace", destinationIndex: selector.index, destinationZone: selector.zone, data: { ...current, props: { ...current.props, ...patch } } });
  }
  function chooseImage(path: string, name: string, index?: number, id = selected?.props.id) {
    const current = latest.current.find((block) => block.props.id === id);
    if (!current) return;
    if (index === undefined) update({ image: path, imageAlt: name.replace(/\.[^.]+$/, "") }, id);
    else update({ items: current.props.items.map((item, i) => i === index ? { ...item, image: path } : item) }, id);
  }
  async function uploadFile(file?: File, index?: number) {
    if (!file || !selected) return;
    const id = selected.props.id;
    try { const { asset } = await upload.mutateAsync(file); chooseImage(asset.path, asset.name, index, id); } catch (error) { onNotice((error as Error).message); }
  }
  function select(index: number) { dispatch({ type: "setUi", ui: { itemSelector: { index, zone: "root:default-zone" } } }); onSelect(); }
  function reorder(from: number, to: number) { dispatch({ type: "reorder", sourceIndex: from, destinationIndex: to, destinationZone: "root:default-zone" }); select(to); }
  function insertBlock(block: Block, index: number) {
    dispatch({ type: "setData", data: (previous) => { const content = [...previous.content]; content.splice(index, 0, block); return { ...previous, content }; } });
    select(index);
  }
  function itemPatch(index: number, patch: Partial<BlockProps["items"][number]>) { update({ items: selected!.props.items.map((item, i) => i === index ? { ...item, ...patch } : item) }); }
  const mediaDialog = <MediaLibrary open={Boolean(media)} onClose={() => setMedia(null)} onSelect={(path, name) => media?.choose(path, name)} />;

  if (tab === "pages") return <div className="editor-panel-content"><PageControls project={project} pageId={pageId} change={change} select={setPageId} notify={onNotice} openMedia={(choose) => setMedia({ choose })} />{mediaDialog}</div>;

  if (tab === "design") return <div className="editor-panel-content">
    <div className="panel-section-heading"><span>YOUR PALETTE</span></div>
    <div className="theme-palette">{([{ key: "background", label: "Canvas" }, { key: "foreground", label: "Text" }, { key: "accent", label: "Accent" }] as const).map(({ key, label }) => <label key={key}><input type="color" aria-label={`${label} color`} value={project.theme[key]} onChange={(event) => change({ ...project, theme: { ...project.theme, [key]: event.target.value } }, `theme:${key}`)} /><span>{label}</span><small>{project.theme[key]}</small></label>)}</div>
    <ContrastFeedback theme={project.theme} />
    <FontControls project={project} change={change} />
    <ThemeLibrary project={project} change={change} />
    <Field label="Typography"><select className="editor-input" aria-label="Typography" value={project.theme.font} onChange={(event) => change({ ...project, theme: { ...project.theme, font: event.target.value as Project["theme"]["font"] } })}><option value="sans">Thoughtful sans serif</option><option value="serif">Editorial serif</option><option value="mono">A little monospace</option></select></Field>
    <Range label="Corner radius" value={project.theme.radius} min={0} max={32} onChange={(radius) => change({ ...project, theme: { ...project.theme, radius } }, "radius")} />
    <label className="editor-check"><input type="checkbox" checked={project.theme.footerCredit} onChange={(event) => change({ ...project, theme: { ...project.theme, footerCredit: event.target.checked } })} /> Show Made with Portfi</label><p className="editor-help">Creator and Pro can remove the footer credit.</p>
    <div className="panel-divider" /><div className="panel-section-heading"><span>{selected ? `${blockLabels[selected.type].toUpperCase()} / LAYOUT` : "SELECT A SECTION"}</span></div>
    {selected ? <>
      <Range label="Content width" value={selected.props.maxWidth} min={480} max={1440} onChange={(maxWidth) => update({ maxWidth })} />
      <Range label="Vertical spacing" value={selected.props.padding} min={16} max={160} onChange={(padding) => update({ padding })} />
      <Range label="Heading size" value={selected.props.fontSize} min={24} max={120} onChange={(fontSize) => update({ fontSize })} />
      <Range label="Image width" value={selected.props.imageWidth} min={30} max={100} unit="%" onChange={(imageWidth) => update({ imageWidth })} />
      <Field label="Image crop"><select className="editor-input" aria-label="Image crop ratio" value={selected.props.imageAspect} onChange={(event) => update({ imageAspect: event.target.value as BlockProps["imageAspect"] })}><option value="auto">Original / template ratio</option><option value="square">Square</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></Field>
      <Field label="Image fit"><select className="editor-input" aria-label="Image fit" value={selected.props.imageFit} onChange={(event) => update({ imageFit: event.target.value as BlockProps["imageFit"] })}><option value="cover">Fill the frame</option><option value="contain">Show the complete image</option></select></Field>
      <Range label="Horizontal focal point" value={selected.props.imageX} min={0} max={100} unit="%" onChange={(imageX) => update({ imageX })} />
      <Range label="Vertical focal point" value={selected.props.imageY} min={0} max={100} unit="%" onChange={(imageY) => update({ imageY })} />
      <Field label="Alignment"><div className="editor-segmented">{(["left", "center"] as const).map((alignment) => <button className={selected.props.alignment === alignment ? "active" : ""} key={alignment} onClick={() => update({ alignment })}>{alignment === "left" ? "Left aligned" : "Centered"}</button>)}</div></Field>
      <Field label="Columns on larger screens"><select className="editor-input" aria-label="Grid columns" value={selected.props.columns} onChange={(event) => update({ columns: Number(event.target.value) })}>{[1, 2, 3].map((count) => <option key={count} value={count}>{count} {count === 1 ? "column" : "columns"}</option>)}</select></Field>
      <Field label="Section background"><div className="section-color-row"><input aria-label="Section background color" type="color" value={selected.props.background || project.theme.background} onChange={(event) => update({ background: event.target.value })} /><span>{selected.props.background || "Inherit canvas"}</span><button onClick={() => update({ background: "" })}>Reset</button></div></Field>
      <ResponsiveControls props={selected.props} update={update} preview={onViewport} />
    </> : <p className="editor-help">Select a section to change its layout and device overrides.</p>}
  </div>;

  if (tab === "motion") return <div className="editor-panel-content">
    <div className="panel-section-heading"><span>A LITTLE MOVEMENT</span></div><p className="editor-panel-intro">Give each entrance a purpose. Reduced-motion preferences take priority.</p>
    {selected ? <>
      <div className="motion-choice-grid">{(["none", "fade", "rise", "scale", "stagger"] as const).map((animation) => <button key={animation} className={selected.props.animation === animation ? "active" : ""} onClick={() => update({ animation })}>{animation === "none" ? "Still" : animation}</button>)}</div>
      <Range label="Duration" value={selected.props.duration} min={.15} max={1.5} unit="s" onChange={(duration) => update({ duration })} />
      <Range label="Entrance delay" value={selected.props.delay} min={0} max={1} unit="s" onChange={(delay) => update({ delay })} />
      {selected.props.animation === "stagger" && <Range label="Item stagger" value={selected.props.stagger} min={0} max={.3} unit="s" onChange={(stagger) => update({ stagger })} />}
      <Field label="Easing"><select aria-label="Animation easing" className="editor-input" value={selected.props.easing} onChange={(event) => update({ easing: event.target.value as BlockProps["easing"] })}><option value="ease-out">Soft ease out</option><option value="ease-in-out">Ease in and out</option><option value="linear">Linear</option></select></Field>
      <Field label="Trigger"><select aria-label="Animation trigger" className="editor-input" value={selected.props.trigger} onChange={(event) => update({ trigger: event.target.value as BlockProps["trigger"] })}><option value="view">When visible</option><option value="load">On page load</option></select></Field>
      <Field label="Hover effect"><select aria-label="Hover effect" className="editor-input" value={selected.props.hover} onChange={(event) => update({ hover: event.target.value as BlockProps["hover"] })}><option value="none">None</option><option value="lift">Lift project cards</option><option value="zoom">Zoom images</option></select></Field>
      <p className="editor-help">Open Preview to replay scroll entrances and test hover effects. Delay, device controls, stagger and hover presets require Creator or Pro to export.</p>
    </> : <p className="editor-help">Choose a section in Content, then come back to add movement.</p>}
  </div>;

  return <div className="editor-panel-content">
    <div className="panel-section-heading"><span>YOUR SECTIONS</span><span>{content.length}</span></div>
    <div className="editor-section-list">{content.map((block, index) => <div key={block.props.id} draggable onDragStart={() => { dragged.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragged.current !== null) reorder(dragged.current, index); dragged.current = null; }} className={`editor-section-item${selected?.props.id === block.props.id ? " active" : ""}`}><button className="section-select" onClick={() => select(index)}><GripVertical size={12} /><span>{blockLabels[block.type]}</span></button><div className="section-order"><button aria-label={`Move ${blockLabels[block.type]} up`} disabled={!index} onClick={() => reorder(index, index - 1)}><ArrowUp size={11} /></button><button aria-label={`Move ${blockLabels[block.type]} down`} disabled={index === content.length - 1} onClick={() => reorder(index, index + 1)}><ArrowDown size={11} /></button></div></div>)}</div>
    <button className="editor-add-page" disabled={content.length >= 40} onClick={() => setAdding(!adding)}><Plus size={13} /> Add a section</button>
    {adding && <div className="editor-add-blocks">{blockTypes.map((type) => <button key={type} onClick={() => { insertBlock(newBlock(type), content.length); setAdding(false); }}><Plus size={12} />{blockLabels[type]}</button>)}</div>}
    <details className="editor-advanced"><summary>Your reusable sections</summary>{library.data?.sections.map((section) => <div className="saved-section-row" key={section.id}><button onClick={() => {
      const copy = structuredClone(section.block); copy.props.id = crypto.randomUUID();
      for (const props of [copy.props, ...copy.props.columnsContent.map((child) => child.content)]) { if (props !== copy.props) props.id = crypto.randomUUID(); props.items = props.items.map((item) => item.pageId && !project.pages.some((page) => page.id === item.pageId) ? { ...item, pageId: undefined, url: "" } : item); }
      insertBlock(copy, content.length);
    }}>{section.name}</button><button className="icon-button" aria-label={`Remove saved section ${section.name}`} onClick={() => deleteSection.mutate(section.id)}><Trash2 size={12} /></button></div>)}{!library.data?.sections.length && <p className="editor-help">Save a section below to reuse it across portfolios.</p>}</details>
    <div className="panel-divider" />
    {selected ? <>
      <div className="panel-section-heading"><span>{blockLabels[selected.type].toUpperCase()}</span><div><button className="icon-button" aria-label="Save reusable section" title="Save to section library" onClick={() => saveSection.mutate()} disabled={saveSection.isPending}><Save size={13} /></button><button className="icon-button" aria-label="Duplicate section" onClick={() => {
        const copy = structuredClone(selected); copy.props.id = crypto.randomUUID(); for (const child of copy.props.columnsContent) child.content.id = crypto.randomUUID();
        insertBlock(copy, selectedIndex + 1);
      }}><Copy size={13} /></button><button className="icon-button" aria-label="Remove section" onClick={() => dispatch({ type: "remove", index: selectedIndex, zone: "root:default-zone" })}><Trash2 size={13} /></button></div></div>
      <Field label="Small introduction"><input className="editor-input" aria-label="Section introduction" value={selected.props.eyebrow} maxLength={160} onChange={(event) => update({ eyebrow: event.target.value })} /></Field>
      <Field label="Heading"><textarea className="editor-input" aria-label="Section heading" value={selected.props.title} maxLength={500} rows={3} onChange={(event) => update({ title: event.target.value })} /></Field>
      <Field label="Your story" note="Use **bold**, *emphasis*, or [label](https://example.com)."><textarea className="editor-input" aria-label="Section description" value={selected.props.description} maxLength={6000} rows={4} onChange={(event) => update({ description: event.target.value })} /></Field>
      {["Image", "ProjectDetail"].includes(selected.type) && <Field label="Image">{selected.props.image && <img className="editor-social-image" src={selected.props.image} alt={selected.props.imageAlt} />}<label className="editor-upload"><Upload size={13} />{upload.isPending ? "Uploading…" : "Upload an image"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={(event) => { void uploadFile(event.target.files?.[0]); }} /></label><button className="editor-add-page" onClick={() => setMedia({ choose: (path, name) => chooseImage(path, name) })}>Choose from library</button><input aria-label="Image alternative text" className="editor-input" value={selected.props.imageAlt} maxLength={300} onChange={(event) => update({ imageAlt: event.target.value })} /></Field>}
      {selected.type === "Columns" && <ColumnControls props={selected.props} update={update} openMedia={(choose) => setMedia({ choose })} />}
      {itemTypes.includes(selected.type) && <>
        <div className="panel-divider" /><div className="panel-section-heading"><span>YOUR ITEMS</span></div>
        {selected.props.items.map((item, index) => <details key={`${selected.props.id}-${index}`} className="editor-item-details" open={index === 0}><summary>{item.title || `Item ${index + 1}`}</summary><div>
          <Field label={selected.type === "Testimonials" ? "Person’s name" : "Title"}><input className="editor-input" aria-label={`Item ${index + 1} title`} value={item.title} maxLength={160} onChange={(event) => itemPatch(index, { title: event.target.value })} /></Field>
          <Field label="Category, dates, or role"><input className="editor-input" aria-label={`Item ${index + 1} category`} value={item.category} maxLength={120} onChange={(event) => itemPatch(index, { category: event.target.value })} /></Field>
          <Field label={selected.type === "Testimonials" ? "Quote" : "Description"}><textarea className="editor-input" aria-label={`Item ${index + 1} description`} value={item.description} maxLength={1200} rows={3} onChange={(event) => itemPatch(index, { description: event.target.value })} /></Field>
          <Field label="Link to a page"><select className="editor-input" aria-label={`Item ${index + 1} page`} value={item.pageId || ""} onChange={(event) => itemPatch(index, { pageId: event.target.value || undefined, url: event.target.value ? "" : item.url })}><option value="">External or email link</option>{project.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select></Field>
          {!item.pageId && <Field label="HTTPS, /page, or mailto: link"><input className="editor-input" aria-label={`Item ${index + 1} link`} value={item.url} maxLength={1000} onChange={(event) => itemPatch(index, { url: event.target.value })} /></Field>}
          {["Projects", "Gallery"].includes(selected.type) && <><label className="editor-upload"><Upload size={12} />{item.image ? "Change image" : "Add image"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadFile(event.target.files?.[0], index); }} /></label><button className="editor-add-page" onClick={() => setMedia({ choose: (path, name) => chooseImage(path, name, index) })}>Choose from library</button></>}
          <button className="editor-danger-link" onClick={() => update({ items: selected.props.items.filter((_, i) => i !== index) })}><Trash2 size={12} /> Remove item</button>
        </div></details>)}
        <button className="editor-add-page" disabled={selected.props.items.length >= 24} onClick={() => update({ items: [...selected.props.items, { title: selected.type === "Contact" ? "Say hello" : "Something worth sharing", category: "", description: "", image: "", url: selected.type === "Contact" ? `mailto:${project.profile.email}` : "" }] })}><Plus size={13} /> Add item</button>
      </>}
    </> : <p className="editor-help">Click a section in the preview to start making it yours.</p>}
    <div className="panel-divider" /><details className="editor-profile"><summary>Your name & details</summary>{([{ key: "name", label: "Your name" }, { key: "role", label: "What you do" }, { key: "email", label: "Contact email" }] as const).map(({ key, label }) => <Field key={key} label={label}><input className="editor-input" aria-label={label} type={key === "email" ? "email" : "text"} value={project.profile[key]} maxLength={key === "name" ? 100 : 160} onChange={(event) => change({ ...project, profile: { ...project.profile, [key]: event.target.value } }, `profile:${key}`)} /></Field>)}</details>
    {mediaDialog}
  </div>;
}

function ColumnControls({ props, update, openMedia }: { props: BlockProps; update: (patch: Partial<BlockProps>) => void; openMedia: (choose: (path: string) => void) => void }) {
  function patch(index: number, next: Partial<BlockProps["columnsContent"][number]["content"]>) { update({ columnsContent: props.columnsContent.map((child, i) => i === index ? { ...child, content: { ...child.content, ...next } } : child) }); }
  return <details className="editor-advanced" open><summary>Your columns</summary><p className="editor-help">Two or three guided columns. Each holds text, an image, or a link group and stacks on small screens.</p>{props.columnsContent.map((child, index) => <div className="column-fields" key={child.content.id}>
    <Field label={`Column ${index + 1} content`}><select className="editor-input" aria-label={`Column ${index + 1} type`} value={child.kind} onChange={(event) => update({ columnsContent: props.columnsContent.map((current, i) => i === index ? { ...current, kind: event.target.value as "Text" | "Image" | "Links" } : current) })}><option value="Text">Text</option><option value="Image">Image</option><option value="Links">Link group</option></select></Field>
    <input className="editor-input" aria-label={`Column ${index + 1} heading`} value={child.content.title} maxLength={500} onChange={(event) => patch(index, { title: event.target.value })} />
    <textarea className="editor-input" aria-label={`Column ${index + 1} description`} value={child.content.description} maxLength={6000} rows={3} onChange={(event) => patch(index, { description: event.target.value })} />
    {child.kind === "Image" && <><button className="editor-add-page" onClick={() => openMedia((image) => patch(index, { image }))}>Choose column image</button><input className="editor-input" aria-label={`Column ${index + 1} image description`} value={child.content.imageAlt} maxLength={300} onChange={(event) => patch(index, { imageAlt: event.target.value })} /></>}
    {child.kind === "Links" && <><input className="editor-input" aria-label={`Column ${index + 1} link label`} value={child.content.items[0]?.title || ""} onChange={(event) => patch(index, { items: [{ title: event.target.value, category: "", description: "", image: "", url: child.content.items[0]?.url || "" }] })} /><input className="editor-input" aria-label={`Column ${index + 1} link URL`} value={child.content.items[0]?.url || ""} onChange={(event) => patch(index, { items: [{ title: child.content.items[0]?.title || "Learn more", category: "", description: "", image: "", url: event.target.value }] })} /></>}
    <div className="settings-button-row"><button className="icon-button" aria-label={`Move column ${index + 1} left`} disabled={!index} onClick={() => { const children = [...props.columnsContent]; [children[index - 1], children[index]] = [children[index], children[index - 1]]; update({ columnsContent: children }); }}><ArrowUp size={12} /></button><button className="editor-danger-link" onClick={() => update({ columnsContent: props.columnsContent.filter((_, i) => i !== index) })}>Remove column</button></div>
  </div>)}<button className="editor-add-page" disabled={props.columnsContent.length >= 3} onClick={() => { const { columnsContent: _children, ...childProps } = newBlock("Text").props; update({ columnsContent: [...props.columnsContent, { kind: "Text", content: childProps }], columns: Math.min(3, props.columnsContent.length + 1) }); }}><Plus size={13} /> Add a column</button></details>;
}
