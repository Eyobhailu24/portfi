"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, ArrowUpRight, Copy, FolderOpen, Info, Pencil, Plus, RotateCcw, Settings2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Brand } from "@/shared/components/brand";
import { Dialog } from "@/shared/components/dialog";
import { TemplatePreview } from "@/shared/components/template-preview";
import { projectSchema, templateMeta, type Project, type TemplateId } from "@/shared/portfolio/schema";
import type { ProjectSummary } from "@/shared/contracts/workspace";
import { api, json } from "@/workspace/api/client";
import { useUploadImage, useWorkspace } from "@/workspace/api/workspace";
import { readDataUrl } from "@/workspace/editor/image-upload";

type Action = "rename" | "duplicate" | "archive" | "unarchive" | "trash" | "restore" | "free-copy" | "purge";

export function Dashboard() {
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<"active" | "archived" | "trash">("active");
  const [pending, setPending] = useState<{ project: ProjectSummary; action: Action } | null>(null);
  const [name, setName] = useState("");
  const importer = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const client = useQueryClient();
  const workspace = useWorkspace();
  const upload = useUploadImage();
  const projects = useQuery({ queryKey: ["workspace", "projects"], queryFn: async () => json<{ projects: ProjectSummary[] }>(await api.api.projects.$get()) });
  const session = useQuery({ queryKey: ["session"], queryFn: async () => json<{ user: { name: string; mode: string } | null }>(await api.api.session.$get()) });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["workspace"] }); };
  const create = useMutation({ mutationFn: async (template: TemplateId) => json<{ project: Project }>(await api.api.projects.$post({ json: { template } })), onSuccess: ({ project }) => { refresh(); router.push(`/editor/${project.id}`); } });
  const action = useMutation({ mutationFn: async () => json<{ project: Project }>(await api.api.projects[":id"].action.$post({ param: { id: pending!.project.id }, json: { action: pending!.action, expectedRevision: pending!.project.revision, ...(pending!.action === "rename" ? { name } : {}) } })), onSuccess: ({ project }) => { const open = pending?.action === "duplicate" || pending?.action === "free-copy"; setPending(null); refresh(); if (open) router.push(`/editor/${project.id}`); } });
  const importBackup = useMutation({ mutationFn: async (file: File) => {
    if (file.size > 30 * 1024 * 1024) throw new Error("Choose a backup smaller than 30 MB.");
    let raw: unknown;
    const replacements = new Map<string, string>();
    if (file.name.toLowerCase().endsWith(".zip")) {
      const { default: JSZip } = await import("jszip");
      const archive = await JSZip.loadAsync(file);
      const document = archive.file("portfolio/project.json");
      if (!document) throw new Error("This ZIP does not contain a Portfi portfolio/project.json file.");
      const text = await document.async("string");
      if (text.length > 10_000_000) throw new Error("This backup document is too large.");
      raw = JSON.parse(text);
      const project = projectSchema.parse(raw);
      for (const url of [...new Set(JSON.stringify(project).match(/\/assets\/uploads\/[a-f0-9-]{36}\.(?:webp|jpg|png|woff2)/g) || [])]) {
        const entry = archive.file(`public${url}`);
        if (!entry) throw new Error("This backup is missing an uploaded image.");
        const bytes = await entry.async("arraybuffer");
        if (bytes.byteLength > 1_100_000) throw new Error("A backup image exceeds the upload limit.");
        const extension = url.split(".").pop();
        const result = extension === "woff2" ? await json<{ asset: { path: string } }>(await api.api.assets.$post({ json: { name: url.split("/").pop()!, data: await readDataUrl(new File([bytes], "font.woff2", { type: "font/woff2" })) } })) : await upload.mutateAsync(new File([bytes], url.split("/").pop()!, { type: extension === "jpg" ? "image/jpeg" : `image/${extension}` }));
        replacements.set(url, result.asset.path);
      }
    } else {
      if (file.size > 10_000_000) throw new Error("Choose a JSON backup smaller than 10 MB.");
      raw = JSON.parse(await file.text());
    }
    let content = JSON.stringify(projectSchema.parse(raw));
    for (const [from, to] of replacements) content = content.replaceAll(from, to);
    return json<{ project: Project }>(await api.api.projects.import.$post({ json: { project: projectSchema.parse(JSON.parse(content)) } }));
  }, onSuccess: ({ project }) => { refresh(); router.push(`/editor/${project.id}`); } });

  const shown = projects.data?.projects.filter((project) => view === "trash" ? Boolean(project.trashedAt) : view === "archived" ? !project.trashedAt && Boolean(project.archivedAt) : !project.trashedAt && !project.archivedAt) || [];
  function ask(project: ProjectSummary, next: Action) { action.reset(); setName(project.name); setPending({ project, action: next }); }

  return <>
    <header className="workspace-header"><Brand /><div><Link href="/#templates">Explore templates</Link><Link href="/settings"><Settings2 size={15} /> Settings</Link><Link href="/login">{session.data?.user?.mode === "account" ? "Your account" : "Sign in"}</Link></div></header>
    <main id="main-content" className="workspace-shell">
      <div className="workspace-title"><div><span className="eyebrow">A LITTLE SPACE FOR YOUR NEXT CHAPTER</span><h1>Your workspace.</h1><p>{workspace.data ? `${workspace.data.plan.source === "preview" ? "Local preview" : workspace.data.plan.name} · ${workspace.data.usage.activePortfolios} / ${workspace.data.plan.portfolios} active portfolios` : "Good things start with something that’s yours."}</p></div><div className="workspace-actions"><button className="button button-outline" onClick={() => importer.current?.click()} disabled={importBackup.isPending}><Upload size={15} />{importBackup.isPending ? "Importing…" : "Import backup"}</button><button className="button button-blue" onClick={() => setPicking(true)}><Plus size={15} /> New portfolio</button></div></div>
      <input ref={importer} hidden type="file" accept=".json,.zip" onChange={(event) => { if (event.target.files?.[0]) importBackup.mutate(event.target.files[0]); event.target.value = ""; }} />
      {session.data?.user?.mode === "guest" && <div className="workspace-note"><Info size={16} /><span>This local workspace is saved for this browser on your development server. Download a source ZIP for a complete backup, including images.</span></div>}
      {workspace.data?.plan.source === "trial" && <div className="workspace-note"><Info size={16} /><span>Your card-free Creator trial ends {new Date(workspace.data.plan.trialEndsAt!).toLocaleDateString()}. Afterward, your work stays saved on Free. <Link href="/settings">View your plan</Link></span></div>}
      {importBackup.isError && <p className="error-message" role="alert">{importBackup.error.message}</p>}
      <div className="workspace-view-tabs" role="group" aria-label="Portfolio view">{(["active", "archived", "trash"] as const).map((item) => <button key={item} aria-pressed={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "active" ? "Your portfolios" : item === "archived" ? "Archived" : "Trash"}</button>)}</div>
      {projects.isPending ? <div className="loading-screen"><span className="loading-spinner" /><p>Opening your workspace…</p></div> : projects.isError ? <div className="empty-state"><FolderOpen size={32} /><h2>Let’s get you settled.</h2><p>{projects.error.message}</p><Link className="button button-blue" href="/login">Sign in <ArrowUpRight size={16} /></Link></div> : <div className="workspace-projects">
        {shown.map((project) => <article className="workspace-project" key={project.id}>
          <div className="workspace-project-art"><TemplatePreview template={project.template} name={project.profile.name} accent={project.theme.accent} /></div>
          <div className="workspace-project-meta"><div><h2>{project.name}</h2><p>{project.pages.length} pages · {templateMeta.find((item) => item.id === project.template)?.name}</p></div>{!project.trashedAt && <Link href={project.archivedAt ? `/preview/${project.id}` : `/editor/${project.id}`} aria-label={`${project.archivedAt ? "Preview" : "Edit"} ${project.name}`} className="icon-button"><ArrowUpRight size={18} /></Link>}</div>
          <div className="workspace-project-actions">{project.trashedAt ? <><button onClick={() => ask(project, "restore")}><RotateCcw size={13} /> Restore portfolio</button><button onClick={() => ask(project, "purge")}><Trash2 size={13}/> Delete permanently</button></> : <>
            <button aria-label={`Rename ${project.name}`} title="Rename" onClick={() => ask(project, "rename")}><Pencil size={13} /></button>
            <button aria-label={`Duplicate ${project.name}`} title="Duplicate" onClick={() => ask(project, "duplicate")}><Copy size={13} /></button>
            <button aria-label={`${project.archivedAt ? "Unarchive" : "Archive"} ${project.name}`} title={project.archivedAt ? "Unarchive" : "Archive"} onClick={() => ask(project, project.archivedAt ? "unarchive" : "archive")}><Archive size={13} /></button>
            <button aria-label={`Move ${project.name} to trash`} title="Move to trash" onClick={() => ask(project, "trash")}><Trash2 size={13} /></button>
            <button onClick={() => ask(project, "free-copy")}>Free copy</button>
          </>}</div>
        </article>)}
        {view === "active" && <button className="workspace-new" onClick={() => setPicking(true)}><Plus size={24} /><span>{shown.length ? "A fresh start" : "Your first portfolio"}</span><small>Find a template. Make it yours.</small></button>}
        {!shown.length && view !== "active" && <div className="empty-state"><FolderOpen size={26} /><h2>{view === "trash" ? "Nothing in the trash." : "No archived portfolios."}</h2><p>Your saved portfolios will appear here.</p></div>}
      </div>}
      <Dialog open={picking} onOpenChange={setPicking} title="Find your starting point." description="Good design is built in. Your personality comes next."><div className="template-picker-grid">{templateMeta.map((template) => <button key={template.id} className="template-picker" onClick={() => create.mutate(template.id)} disabled={create.isPending}><div className="template-picker-art"><TemplatePreview template={template.id} /></div><span className="template-picker-label">{template.name}<ArrowUpRight size={14} /></span></button>)}</div>{create.isError && <p className="error-message" role="alert">{create.error.message}</p>}</Dialog>
      <Dialog open={Boolean(pending)} onOpenChange={() => setPending(null)} title={pending?.action === "rename" ? "A name that feels right." : pending?.action === "free-copy" ? "Make a Free-compatible copy?" : `${pending?.action ? pending.action[0].toUpperCase() + pending.action.slice(1) : "Update"} this portfolio?`} description={pending?.action === "purge" ? "This permanently deletes the saved portfolio, its version history, and Portfi publish-job records. It cannot be undone. Your uploaded media and websites already published in your accounts remain there." : pending?.action === "free-copy" ? "This archives the original and creates a Studio copy with up to three pages, essential motion, default device styles, and the Portfi credit. Removed page links are cleared. The complete original stays saved." : pending?.action === "trash" ? "This moves the portfolio to recoverable trash. It does not remove websites already published in your accounts." : pending?.action === "archive" ? "Archived work stays saved and frees an active portfolio slot. Unarchive it before editing or publishing." : "Your workspace will update after this action."}>
        {pending?.action === "rename" && <label className="field-label">Portfolio name<input className="text-input" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>}
        {action.isError && <p className="error-message" role="alert">{action.error.message}</p>}
        <div className="dialog-footer"><button className="button button-outline" onClick={() => setPending(null)}>Cancel</button><button className="button button-blue" onClick={() => action.mutate()} disabled={action.isPending || pending?.action === "rename" && !name.trim()}>{action.isPending ? "Updating…" : "Continue"}</button></div>
      </Dialog>
    </main>
  </>;
}
