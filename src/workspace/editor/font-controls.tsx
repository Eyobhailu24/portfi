"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Project } from "@/shared/portfolio/schema";
import { api, json } from "@/workspace/api/client";
import type { AssetInfo } from "@/workspace/api/workspace";
import { readDataUrl } from "./image-upload";

export function FontControls({ project, change }: { project: Project; change: (project: Project) => void }) {
  const [licensed, setLicensed] = useState(false);
  const client = useQueryClient();
  const library = useQuery({ queryKey: ["assets"], queryFn: async () => json<{ assets: AssetInfo[] }>(await api.api.assets.$get()) });
  const remove = useMutation({ mutationFn: async (id: string) => json(await api.api.assets[":id"].$delete({ param: { id } })), onSuccess: () => { void client.invalidateQueries({ queryKey: ["assets"] }); } });
  const fonts = library.data?.assets.filter((asset) => asset.type === "font/woff2") || [];
  const upload = useMutation({ mutationFn: async (file: File) => {
    if (!licensed) throw new Error("Confirm that you have permission to use this font.");
    if (!file.name.toLowerCase().endsWith(".woff2") || file.size > 400_000) throw new Error("Choose a WOFF2 font smaller than 400 KB.");
    const data = await readDataUrl(new File([file], file.name, { type: "font/woff2" }));
    return json<{ asset: AssetInfo }>(await api.api.assets.$post({ json: { name: file.name.slice(0, 160), data } }));
  }, onSuccess: ({ asset }) => { change({ ...project, theme: { ...project.theme, font: "custom", customFont: asset.path } }); void client.invalidateQueries({ queryKey: ["assets"] }); } });
  return <details className="editor-advanced"><summary>Your own font <span>Creator & Pro</span></summary><label className="editor-check"><input type="checkbox" checked={licensed} onChange={(event) => setLicensed(event.target.checked)} /> I have permission to use and publish this font.</label><label className="editor-upload">Upload a WOFF2 font<input type="file" accept=".woff2" disabled={!licensed || upload.isPending} onChange={(event) => { if (event.target.files?.[0]) upload.mutate(event.target.files[0]); event.target.value = ""; }} /></label><select className="editor-input" aria-label="Custom font" value={project.theme.customFont} onChange={(event) => change({ ...project, theme: { ...project.theme, customFont: event.target.value, font: event.target.value ? "custom" : "sans" } })}><option value="">Select a library font</option>{fonts.map((asset) => <option key={asset.id} value={asset.path}>{asset.name}</option>)}</select>{upload.isError && <p className="error-message" role="alert">{upload.error.message}</p>}{fonts.length > 0 && <details><summary>Manage saved fonts</summary>{fonts.map((asset) => <p key={asset.id}>{asset.name} <button type="button" className="inline-button" disabled={remove.isPending || project.theme.customFont === asset.path} onClick={() => remove.mutate(asset.id)}>Delete unused font</button></p>)}<p className="editor-help">Fonts used by a portfolio, theme, or saved revision are protected from deletion.</p></details>}{remove.isError && <p className="error-message" role="alert">{remove.error.message}</p>}<p className="editor-help">Font files are included in your source export. Keep any required license/attribution with your published project.</p></details>;
}
