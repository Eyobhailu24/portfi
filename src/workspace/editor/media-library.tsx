"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/shared/components/dialog";
import { api, json } from "@/workspace/api/client";
import { useUploadImage, type AssetInfo } from "@/workspace/api/workspace";

export function MediaLibrary({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (path: string, name: string) => void }) {
  const client = useQueryClient();
  const library = useQuery({ queryKey: ["assets"], queryFn: async () => json<{ assets: AssetInfo[] }>(await api.api.assets.$get()), enabled: open });
  const upload = useUploadImage();
  const remove = useMutation({ mutationFn: async (id: string) => json(await api.api.assets[":id"].$delete({ param: { id } })), onSuccess: () => { void client.invalidateQueries({ queryKey: ["assets"] }); void client.invalidateQueries({ queryKey: ["workspace", "account"] }); } });
  const error = library.error || upload.error || remove.error;
  return <Dialog open={open} onOpenChange={onClose} title="Your image library." description="Images belong to this workspace. Used images are kept while a portfolio, saved version, or reusable section still references them.">
    <label className="button button-outline">{upload.isPending ? "Uploading…" : "Upload an image"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ""; }} /></label>
    {error && <p className="error-message" role="alert">{error.message}</p>}
    <div className="media-library">{library.data?.assets.filter((asset) => asset.type.startsWith("image/")).map((asset) => <article key={asset.id}><button className="media-select" onClick={() => { onSelect(asset.path, asset.name); onClose(); }}><img src={asset.path} alt="" width="220" height="150" /><span>{asset.name}</span></button><button className="media-delete" disabled={remove.isPending} onClick={() => remove.mutate(asset.id)}>Remove unused image</button></article>)}</div>
    {library.data?.assets.length === 0 && <p className="editor-help">Your next image goes here. Upload one to begin.</p>}
  </Dialog>;
}
