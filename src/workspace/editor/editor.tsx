"use client";
import { History as HistoryIcon } from "lucide-react";
import { EditorPanels } from "./editor-panels";
import { HistoryDialog } from "./history-dialog";
import { PublishDialog } from "./publish-dialog";


import { Puck } from "@puckeditor/core";
import type { Data } from "@puckeditor/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Check, ChevronDown, Code2, Copy, Download, ExternalLink, Eye, FileText, Github, Globe2, GripVertical, ImageIcon, Info, Layers3, Loader2, Monitor, MoreHorizontal, MousePointer2, Palette, PanelLeft, Plus, Redo2, Rocket, Settings2, Smartphone, Sparkles, Tablet, Trash2, Undo2, Upload, X } from "lucide-react";
import { Dialog } from "@/shared/components/dialog";
import { Brand } from "@/shared/components/brand";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import { api, json } from "@/workspace/api/client";
import { blockTypes, duplicatePage, newBlock, projectSchema, type Block, type BlockProps, type BlockType, type Project } from "@/shared/portfolio/schema";
import { blockLabels, portfolioConfig, toEditorData, useEditor, type EditorData } from "./config";
import { backupKey, signature, useAutosave } from "./use-autosave";
import { optimizeUpload } from "./image-upload";
import "@puckeditor/core/puck.css";
import "./editor.css";
import "./editor-features.css";

type Tab = "content" | "design" | "motion" | "pages";
type Capabilities = { auth: boolean; guest: boolean; publishing: boolean; billing: boolean };

function previousSectionIds(project: Project, currentPage: string) {
  return project.pages.filter((page) => page.id !== currentPage).flatMap((page) => page.blocks.flatMap((block) => [block.props.id, ...block.props.columnsContent.map((child) => child.content.id)]));
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EditorApp({ id }: { id: string }) {
  const client = useQueryClient();
  const [resetKey, setResetKey] = useState(0);
  const query = useQuery({ queryKey: ["project", id], queryFn: async () => json<{ project: Project }>(await api.api.projects[":id"].$get({ param: { id } })) });
  if (query.isPending) return <main id="main-content" className="loading-screen"><Brand/><span className="loading-spinner"/><p>Finding your place…</p></main>;
  if (query.isError) return <main id="main-content" className="loading-screen"><Brand/><p>{query.error.message}</p><Link href="/dashboard" className="button button-blue">Back to your workspace</Link></main>;
  return <ProjectEditor key={`${id}:${resetKey}`} initial={projectSchema.parse(query.data.project)} onRestore={(project) => { client.setQueryData(["project", id], { project }); void client.invalidateQueries({ queryKey: ["history", id] }); setResetKey((value) => value + 1); }}/>;
}

function ProjectEditor({ initial, onRestore }: { initial: Project; onRestore: (project: Project) => void }) {
  const [project, setProject] = useState(initial);
  const [pageId, setPageId] = useState(initial.pages[0].id);
  const [tab, setTab] = useState<Tab>("content");
  const [restoreToken, setRestoreToken] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("preview");
  const [dialog, setDialog] = useState<"publish" | "code" | "settings" | "history" | null>(null);
  const [recovery, setRecovery] = useState<Project | null>(null);
  const recoveryChecked = useRef(false);
  const [notice, setNotice] = useState("");
  const [historyIndex, setHistoryIndex] = useState(0);
  const history = useRef([initial]);
  const historyPosition = useRef(0);
  const lastChange = useRef({ at: 0, group: "" });
  const latest = useRef(project);
  latest.current = project;
  const autosave = useAutosave(project, initial);
  const page = project.pages.find((item) => item.id === pageId) || project.pages[0];
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: async () => json<Capabilities>(await api.api.capabilities.$get()) });
  const session = useQuery({ queryKey: ["session"], queryFn: async () => json<{ user: { mode: string } | null }>(await api.api.session.$get()) });

  const change = useCallback((next: Project | ((previous: Project) => Project), group = "") => {
    const previous = latest.current;
    const value = typeof next === "function" ? next(previous) : next;
    if (signature(previous) === signature(value)) return;
    const now = Date.now();
    const coalesce = group && lastChange.current.group === group && now - lastChange.current.at < 650 && historyPosition.current > 0;
    if (coalesce) history.current[historyPosition.current] = value;
    else {
      history.current = [...history.current.slice(0, historyPosition.current + 1), value].slice(-50);
      historyPosition.current = history.current.length - 1;
    }
    lastChange.current = { at: now, group };
    latest.current = value;
    setHistoryIndex(historyPosition.current); setProject(value);
  }, []);

  function moveHistory(direction: -1 | 1) {
    const next = historyPosition.current + direction;
    if (next < 0 || next >= history.current.length) return;
    historyPosition.current = next;
    const snapshot = history.current[next];
    latest.current = snapshot; setProject(snapshot); setHistoryIndex(next);
    setRestoreToken((value) => value + 1); lastChange.current = { at: 0, group: "" };
    if (!snapshot.pages.some((item) => item.id === pageId)) setPageId(snapshot.pages[0].id);
  }

  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;
    try {
      const raw = localStorage.getItem(backupKey(initial.id));
      if (raw) {
        const stored = JSON.parse(raw);
        const parsed = projectSchema.safeParse(stored.project);
        if (parsed.success && signature(parsed.data) !== signature(initial)) setRecovery(parsed.data);
      }
    } catch { /* An invalid backup is never loaded into the editor. */ }
  }, [initial]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const exportMutation = useMutation({ mutationFn: async () => {
    await autosave.flush();
    const response = await api.api.projects[":id"].export.$post({ param: { id: project.id } });
    if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error || "Export failed. Your work is still saved."); }
    return response.blob();
  }, onSuccess: (blob) => { downloadBlob(blob, `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "portfolio"}-portfi.zip`); setNotice("Your standalone portfolio is ready. Make it yours."); } });

  const config = useMemo(() => portfolioConfig(project, page.slug), [project.theme, project.profile, project.pages.map((item) => `${item.id}:${item.name}:${item.slug}`).join("|"), page.slug, project.id]);

  const onEditorChange = useCallback((data: EditorData) => {
    // Keep incomplete input locally editable; the server validates complete save documents.
    const occupied = new Set(previousSectionIds(latest.current, page.id));
    let normalized = false;
    const blocks: Block[] = data.content.map((item) => {
      const block = { type: item.type as BlockType, props: structuredClone(item.props) as BlockProps };
      for (const props of [block.props, ...block.props.columnsContent.map((child) => child.content)]) {
        if (occupied.has(props.id)) { props.id = crypto.randomUUID(); normalized = true; }
        occupied.add(props.id);
      }
      return block;
    });
    change((previous) => ({ ...previous, pages: previous.pages.map((item) => item.id === page.id ? { ...item, blocks } : item) }), `page:${page.id}`);
    if (normalized) setRestoreToken((value) => value + 1);
  }, [change, page.id]);

  const backup = () => downloadBlob(new Blob([JSON.stringify(latest.current, null, 2)], { type: "application/json" }), "portfi-draft-backup.json");

  return <div className="editor-app"><header className="editor-header"><div className="editor-heading"><Link href="/dashboard" className="editor-back icon-button" aria-label="Back to workspace"><ArrowLeft size={17}/></Link><Brand/><span className="editor-header-divider"/><input aria-label="Portfolio name" className="editor-project-name" value={project.name} maxLength={100} onChange={(event) => change({ ...project, name: event.target.value }, "project-name")}/><span className="editor-save" role="status">{autosave.saving ? <Loader2 size={12} className="spin"/> : autosave.error ? <Info size={12}/> : <Check size={12}/>}<span>{autosave.error ? "Save needs attention" : autosave.saving ? "Saving…" : autosave.dirty ? "Changes pending" : "All changes saved"}</span></span></div><div className="editor-header-actions"><div className="editor-history"><button className="icon-button" title="Undo" aria-label="Undo" disabled={historyIndex === 0} onClick={() => moveHistory(-1)}><Undo2 size={16}/></button><button className="icon-button" title="Redo" aria-label="Redo" disabled={historyIndex === history.current.length - 1} onClick={() => moveHistory(1)}><Redo2 size={16}/></button></div><button className="icon-button" aria-label="Version history" title="Version history" onClick={() => setDialog("history")}><HistoryIcon size={16}/></button><button className="icon-button editor-code-button" aria-label="View project code" title="View project code" onClick={() => setDialog("code")}><Code2 size={17}/></button><button className="button button-editor-preview" onClick={async () => { try { await autosave.flush(); window.open(`/preview/${project.id}/${page.slug}`, "_blank", "noopener,noreferrer"); } catch { setNotice("Please resolve the save issue before opening the saved preview."); } }}><Eye size={14}/><span>Preview</span></button><Button className="editor-publish" onClick={() => setDialog("publish")}><span>Publish</span><ArrowUpRight size={14}/></Button></div></header>
    {recovery && <div className="editor-recovery"><Info size={14}/><span>A local draft is available from your last editing session.</span><button onClick={() => { change({ ...recovery, revision: initial.revision }); setRestoreToken((value) => value + 1); setRecovery(null); }}>Restore draft</button><button aria-label="Dismiss recovered draft" onClick={() => setRecovery(null)}><X size={13}/></button></div>}
    {autosave.error && <div className="editor-recovery error"><Info size={14}/><span>{autosave.error.message}</span><button onClick={backup}>Download draft backup</button><button onClick={() => window.location.reload()}>Reload latest saved version</button></div>}
    <Puck key={`${page.id}:${restoreToken}`} config={config} data={toEditorData(page)} onChange={onEditorChange} iframe={{ enabled: true, syncHostStyles: true }} ui={{ itemSelector: page.blocks.length ? { index: 0, zone: "root:default-zone" } : null }}>
      <div className={`editor-layout mobile-${mobileView}`}><aside className="editor-sidebar" aria-label="Portfolio settings"><div className="editor-sidebar-top"><div className="editor-page-title"><span><FileText size={14}/>{page.name}</span><button className="icon-button" aria-label="Page settings" onClick={() => setTab("pages")}><ChevronDown size={13}/></button></div><div className="editor-tabs" role="tablist" aria-label="Editing panels" onKeyDown={(event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const index = tabs.findIndex((button) => button === event.target);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next]?.click(); tabs[next]?.focus();
}}>{[{ id: "content", label: "Content", icon: Layers3 }, { id: "design", label: "Design", icon: Palette }, { id: "motion", label: "Motion", icon: Sparkles }, { id: "pages", label: "Pages", icon: FileText }].map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`editor-tab-${id}`} aria-controls="editor-panel" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id as Tab)}><Icon size={14}/><span>{label}</span></button>)}</div></div><div id="editor-panel" className="editor-sidebar-scroll" role="tabpanel" aria-labelledby={`editor-tab-${tab}`}><EditorPanels tab={tab} project={project} change={change} pageId={page.id} setPageId={setPageId} onNotice={setNotice} onSelect={() => setMobileView("edit")} onViewport={setViewport}/></div><div className="editor-sidebar-footer"><span className="tiny-dot"/>{session.data?.user?.mode === "guest" ? "LOCAL PREVIEW WORKSPACE" : "YOUR PORTFI WORKSPACE"}<button className="icon-button" aria-label="Workspace settings" onClick={() => setDialog("settings")}><Settings2 size={13}/></button></div></aside><main id="main-content" className="editor-main"><div className="editor-preview-toolbar"><span><span className="tiny-dot"/> LIVE PREVIEW</span><div className="viewport-controls" aria-label="Preview device size">{([{ id: "desktop", icon: Monitor, label: "Desktop" }, { id: "tablet", icon: Tablet, label: "Tablet" }, { id: "mobile", icon: Smartphone, label: "Mobile" }] as const).map(({ id, icon: Icon, label }) => <button key={id} className={viewport === id ? "active" : ""} aria-label={`${label} preview`} aria-pressed={viewport === id} onClick={() => setViewport(id)}><Icon size={15}/></button>)}</div><span className="preview-hint"><MousePointer2 size={11}/> Click anything to make it yours</span></div><EditorCanvas viewport={viewport}/><div className="editor-preview-footer"><span>{project.pages.length} pages <span>·</span> {page.name}</span><span>Thoughtful by design. Yours by default.</span><button onClick={() => setNotice("Drag a section in the preview, or use the section arrows in Content. Change section widths under Design.")}><Info size={12}/> Editing tips</button></div></main></div>
    </Puck>
    <div className="editor-mobile-tabs"><button className={mobileView === "edit" ? "active" : ""} onClick={() => setMobileView("edit")}><PanelLeft size={16}/> Edit</button><button className={mobileView === "preview" ? "active" : ""} onClick={() => setMobileView("preview")}><Eye size={16}/> Preview</button></div>
    {notice && <div className="editor-toast" role="status"><Info size={15}/>{notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={14}/></button></div>}
    <PublishDialog open={dialog === "publish"} onClose={() => setDialog(null)} project={project} flush={autosave.flush} revision={autosave.currentRevision} download={() => exportMutation.mutate()} downloading={exportMutation.isPending} downloadError={exportMutation.error?.message}/><HistoryDialog open={dialog === "history"} onClose={() => setDialog(null)} project={project} flush={autosave.flush} revision={autosave.currentRevision} onRestore={onRestore}/>
    <Dialog open={dialog === "code"} onOpenChange={() => setDialog(null)} title="Good design. Real code." description="The export uses the same portfolio components you see in the preview. It builds independently of Portfi."><div className="code-file-label"><Code2 size={14}/> app/{page.slug ? `${page.slug}/` : ""}page.tsx</div><pre className="code-preview">{`import project from "../portfolio/project.json";\nimport { PortfolioDocument } from\n  "../portfolio/components";\n\nexport default function Page() {\n  return (\n    <PortfolioDocument\n      project={project}\n      pageSlug="${page.slug}"\n    />\n  );\n}`}</pre><div className="dialog-footer"><button className="button button-outline" onClick={backup}><Download size={14}/> Draft JSON</button><button className="button button-blue" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}><Download size={14}/> Download source</button></div>{exportMutation.isError && <p className="error-message">{exportMutation.error.message}</p>}</Dialog>
    <Dialog open={dialog === "settings"} onOpenChange={() => setDialog(null)} title="A space that’s yours." description="Manage your plan, provider connections, and account from workspace settings."><div className="dialog-footer"><button className="button button-outline" onClick={backup}>Download draft JSON</button><Link href="/settings" className="button button-blue">Open settings <ArrowUpRight size={14}/></Link></div></Dialog>
  </div>;
}

function EditorCanvas({ viewport }: { viewport: "desktop" | "tablet" | "mobile" }) {
  const area = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1000, height: 800 });
  const width = viewport === "desktop" ? 1120 : viewport === "tablet" ? 768 : 390;
  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, Math.max(0.2, (bounds.width - 56) / width));
  return <div className="editor-canvas-area" ref={area}><div className="editor-browser-label"><span/><span/><span/><span>{viewport === "desktop" ? "Desktop" : viewport === "tablet" ? "Tablet" : "Mobile"} · {width}px</span></div><div className="editor-canvas-outer" style={{ width: width * scale, height: Math.max(400, bounds.height - 72) }}><div className="editor-canvas-inner" style={{ width, height: Math.max(400, bounds.height - 72) / scale, transform: `scale(${scale})` }}><Puck.Preview/></div></div></div>;
}






