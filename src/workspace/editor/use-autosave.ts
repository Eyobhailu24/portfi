"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, json } from "@/workspace/api/client";
import type { Project } from "@/shared/portfolio/schema";

export const signature = (project: Project) => JSON.stringify({ ...project, revision: 0 });
export const backupKey = (id: string) => `portfi:draft:${id}`;

export function useAutosave(project: Project, initial: Project) {
  const client = useQueryClient();
  const latest = useRef(project);
  const revision = useRef(initial.revision);
  const saved = useRef(signature(initial));
  const inFlight = useRef<Promise<void> | null>(null);
  const [savedSignature, setSavedSignature] = useState(saved.current);
  latest.current = project;
  const mutation = useMutation({
    mutationKey: ["project-save", project.id],
    mutationFn: async (input: { project: Project; expectedRevision: number }) => json<{ project: Project }>(await api.api.projects[":id"].$put({ param: { id: input.project.id }, json: input })),
  });
  const mutateAsync = mutation.mutateAsync;

  const flush = useCallback(async () => {
    while (signature(latest.current) !== saved.current) {
      if (inFlight.current) { await inFlight.current; continue; }
      const snapshot = structuredClone(latest.current);
      const snapshotSignature = signature(snapshot);
      const request = mutateAsync({ project: { ...snapshot, revision: revision.current }, expectedRevision: revision.current }).then(({ project: persisted }) => {
        revision.current = persisted.revision;
        saved.current = snapshotSignature;
        setSavedSignature(snapshotSignature);
        client.setQueryData(["project", snapshot.id], { project: persisted });
        void client.invalidateQueries({ queryKey: ["workspace", "projects"] });
        if (signature(latest.current) === snapshotSignature) { try { localStorage.removeItem(backupKey(snapshot.id)); } catch {} }
      });
      inFlight.current = request;
      try { await request; } finally { inFlight.current = null; }
    }
  }, [mutateAsync, client]);

  useEffect(() => {
    if (signature(project) === saved.current) return;
    try { localStorage.setItem(backupKey(project.id), JSON.stringify({ project, expectedRevision: revision.current })); } catch { /* Server autosave remains active if browser storage is full. */ }
    const timer = setTimeout(() => { void flush().catch(() => {}); }, 850);
    return () => clearTimeout(timer);
  }, [project, flush]);

  const dirty = signature(project) !== savedSignature;
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (signature(latest.current) !== saved.current) { event.preventDefault(); } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);

  return { flush, dirty, saving: mutation.isPending, error: mutation.error, revision: revision.current, currentRevision: () => revision.current };
}
