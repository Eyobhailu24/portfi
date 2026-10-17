"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { ArrowUpRight, Download, Github, Globe2, Info } from "lucide-react";
import { Dialog } from "@/shared/components/dialog";
import type { Project } from "@/shared/portfolio/schema";
import { api, json } from "@/workspace/api/client";

type Jobs = InferResponseType<typeof api.api.projects[":id"]["publishing"]["$get"]>;
const terminal = ["succeeded", "failed", "canceled", "needs_attention"];

export function PublishDialog({ open, onClose, project, flush, revision, download, downloading, downloadError }: { open: boolean; onClose: () => void; project: Project; flush: () => Promise<void>; revision: () => number; download: () => void; downloading: boolean; downloadError?: string }) {
  const [repository, setRepository] = useState(`portfi-${project.id.slice(0, 8)}`);
  const requestKey = useRef<string | null>(null);
  const client = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: async () => json<{ user: { mode: string } | null }>(await api.api.session.$get()), enabled: open });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: async () => json<{ publishing: boolean }>(await api.api.capabilities.$get()), enabled: open });
  const connections = useQuery({ queryKey: ["connections"], queryFn: async () => json<{ github: { account: string } | null; vercel: { account: string } | null }>(await api.api.connections.$get()), enabled: open });
  const jobs = useQuery({ queryKey: ["publishing", project.id], queryFn: async () => json<Jobs>(await api.api.projects[":id"].publishing.$get({ param: { id: project.id } })), enabled: open && session.data?.user?.mode === "account", refetchInterval: (query) => query.state.data?.jobs.some((job) => !terminal.includes(job.status)) ? 3000 : false });
  useEffect(() => { if (!open) requestKey.current = null; }, [open]);
  useEffect(() => { const url = jobs.data?.jobs[0]?.repository; if (url) setRepository(url.split("/").pop()!); }, [jobs.data?.jobs[0]?.repository]);
  const publish = useMutation({ mutationFn: async () => {
    await flush();
    requestKey.current ||= crypto.randomUUID();
    return json(await api.api.projects[":id"].publishing.$post({ param: { id: project.id }, json: { expectedRevision: revision(), repositoryName: repository, idempotencyKey: requestKey.current } }));
  }, onSuccess: () => { requestKey.current = null; void client.invalidateQueries({ queryKey: ["publishing", project.id] }); } });
  const action = useMutation({ mutationFn: async ({ id, action }: { id: string; action: "retry" | "cancel" }) => json(await api.api.publishing[":id"].action.$post({ param: { id }, json: { action } })), onSuccess: () => { void client.invalidateQueries({ queryKey: ["publishing", project.id] }); } });
  const ready = capabilities.data?.publishing && connections.data?.github && connections.data?.vercel && session.data?.user?.mode === "account";
  const active = jobs.data?.jobs.some((job) => !terminal.includes(job.status));
  const error = publish.error || action.error || jobs.error;

  return <Dialog open={open} onOpenChange={onClose} title="Your work. Out in the world." description="Publish through your own GitHub and Vercel accounts, or download a standalone project.">
    <div className="publish-status"><Info size={17} /><p>{ready ? "Your accounts are connected. Publishing creates or updates a dedicated Portfi repository and deploys the same source to Vercel." : "Connect your accounts in Settings after configuring the provider integrations and worker. Source download works in the meantime."}</p></div>
    <div className="connection-chips"><span><Github size={14} />{connections.data?.github?.account || "GitHub not connected"}</span><span><Globe2 size={14} />{connections.data?.vercel?.account || "Vercel not connected"}</span></div>
    <label className="field-label">Dedicated repository name<input className="text-input" value={repository} maxLength={80} onChange={(event) => { setRepository(event.target.value); requestKey.current = null; }} /></label>
    <p className="editor-help">Use an unused repository name for the first publish. Portfi protects unrelated repositories and stops if managed source has changed outside the editor.</p>
    <div className="dialog-footer"><Link href="/settings" className="button button-outline">Manage connections <ArrowUpRight size={14} /></Link><button className="button button-blue" disabled={!ready || publish.isPending || active || !repository.trim()} onClick={() => publish.mutate()}>{publish.isPending ? "Queuing…" : active ? "Publishing in progress" : "Publish portfolio"}<ArrowUpRight size={15} /></button></div>
    {error && <p className="error-message" role="alert">{error.message}</p>}
    <div className="publish-jobs" aria-live="polite">{jobs.data?.jobs.slice(0, 5).map((job) => <article key={job.id}><div><b>{job.status.replaceAll("_", " ")} · v{job.revision}</b><small>{new Date(job.createdAt).toLocaleString()}</small></div><p>{job.message || "Your publish is waiting for the worker."}</p><div className="settings-button-row">{job.repository && <a href={job.repository} target="_blank" rel="noreferrer" className="text-link">View source <ArrowUpRight size={12} /></a>}{job.url && <a href={job.url} target="_blank" rel="noreferrer" className="text-link">{job.status === "succeeded" ? "Open portfolio" : "View deployment"}<ArrowUpRight size={12} /></a>}{["failed", "needs_attention"].includes(job.status) && <button className="button button-outline button-small" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, action: "retry" })}>Retry safely</button>}{!terminal.includes(job.status) && <button className="button button-outline button-small" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, action: "cancel" })}>Cancel</button>}</div></article>)}</div>
    <div className="panel-divider" /><h3 className="publish-download-title">Keep an independent copy.</h3><p className="publish-fine-print">The source ZIP includes your pages, fonts, images, components, styles, and animations. You can also unzip it, upload it to GitHub, and import that repository into Vercel manually.</p><button className="button button-outline" disabled={downloading} onClick={download}><Download size={14} />{downloading ? "Preparing your project…" : "Download source ZIP"}</button>{downloadError && <p className="error-message" role="alert">{downloadError}</p>}
    <p className="publish-fine-print">Hosting and domain costs are separate. Disconnecting Portfi or changing plans does not delete an existing live website.</p>
  </Dialog>;
}
