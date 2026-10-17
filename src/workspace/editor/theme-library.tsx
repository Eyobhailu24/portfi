"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Project } from "@/shared/portfolio/schema";
import { api, json } from "@/workspace/api/client";

export function ThemeLibrary({ project, change }: { project: Project; change: (project: Project) => void }) {
  const [name, setName] = useState("");
  const library = useQuery({ queryKey: ["themes"], queryFn: async () => json<{ themes: { id: string; name: string; theme: Project["theme"] }[]; locked: boolean }>(await api.api.themes.$get()) });
  const save = useMutation({ mutationFn: async () => json(await api.api.themes.$post({ json: { name: name.trim() || "My theme", theme: project.theme } })), onSuccess: () => { setName(""); void library.refetch(); } });
  const remove = useMutation({ mutationFn: async (id: string) => json(await api.api.themes[":id"].$delete({ param: { id } })), onSuccess: () => { void library.refetch(); } });
  return <details className="editor-advanced"><summary>Reusable themes <span>Pro</span></summary><p className="editor-help">Save a palette, font and corner style to reuse across your portfolios.</p><input className="editor-input" aria-label="Theme name" placeholder="Theme name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /><button className="editor-add-page" disabled={library.data?.locked || save.isPending} onClick={() => save.mutate()}>Save current theme</button>{library.data?.locked && <p className="editor-help">Upgrade to Pro to use your reusable theme library.</p>}{library.data?.themes.map((theme) => <div className="saved-section-row" key={theme.id}><button onClick={() => change({ ...project, theme: theme.theme })}>{theme.name}</button><button className="icon-button" aria-label={`Remove theme ${theme.name}`} onClick={() => remove.mutate(theme.id)}>×</button></div>)}{(save.error || remove.error) && <p className="error-message">{(save.error || remove.error)!.message}</p>}</details>;
}
