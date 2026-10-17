"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog } from "@/shared/components/dialog";
import type { Project } from "@/shared/portfolio/schema";
import { api, json } from "@/workspace/api/client";

export function HistoryDialog({ open, onClose, project, flush, revision, onRestore }: { open: boolean; onClose: () => void; project: Project; flush: () => Promise<void>; revision: () => number; onRestore: (project: Project) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const history = useQuery({ queryKey: ["history", project.id], queryFn: async () => json<{ revisions: { revision: number; createdAt: string; label: string }[] }>(await api.api.projects[":id"].history.$get({ param: { id: project.id } })), enabled: open, staleTime: 0 });
  const restore = useMutation({ mutationFn: async () => {
    await flush();
    return json<{ project: Project }>(await api.api.projects[":id"].history.restore.$post({ param: { id: project.id }, json: { revision: selected!, expectedRevision: revision() } }));
  }, onSuccess: ({ project }) => { onRestore(project); setSelected(null); onClose(); } });
  const checkpoint = useMutation({ mutationFn: async () => { await flush(); return json(await api.api.projects[":id"].history.checkpoint.$post({ param: { id: project.id }, json: { expectedRevision: revision(), label: label.trim() || "Saved version" } })); }, onSuccess: () => { setLabel(""); void history.refetch(); } });
  return <Dialog open={open} onOpenChange={onClose} title="A little room to go back." description="Restore a saved revision as a new version. Your current saved version stays in history while it is within your plan's retention window.">
    <label className="field-label">Version name<input className="text-input" value={label} maxLength={80} placeholder="Before a new direction" onChange={(event) => setLabel(event.target.value)} /></label><button className="button button-outline" disabled={checkpoint.isPending} onClick={() => checkpoint.mutate()}>Save named version</button><p className="editor-help">Automatic snapshots are spaced at least a minute apart. Up to 200 snapshots are available within your plan’s history window; the local preview keeps 30.</p>
    {checkpoint.isError && <p className="error-message" role="alert">{checkpoint.error.message}</p>}
    {history.isPending ? <p>Loading saved versions…</p> : history.isError ? <p className="error-message">{history.error.message}</p> : !history.data.revisions.length ? <p className="editor-help">Version history is available on Creator and Pro. Your current work remains saved on Free.</p> : <div className="revision-list">{history.data.revisions.map((item) => <label key={item.revision}><input type="radio" name="revision" value={item.revision} checked={selected === item.revision} onChange={() => setSelected(item.revision)} /><span><b>{item.label} · v{item.revision}</b><small>{new Date(item.createdAt).toLocaleString()}</small></span></label>)}</div>}
    {restore.isError && <p className="error-message" role="alert">{restore.error.message}</p>}
    <div className="dialog-footer"><button className="button button-outline" onClick={onClose}>Keep editing</button><button className="button button-blue" disabled={selected === null || restore.isPending} onClick={() => restore.mutate()}>{restore.isPending ? "Restoring…" : "Restore selected version"}</button></div>
  </Dialog>;
}
