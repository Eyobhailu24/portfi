"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, json } from "./client";
import { optimizeUpload } from "@/workspace/editor/image-upload";

export type WorkspaceInfo = InferResponseType<typeof api.api.workspace.$get>;
export type AssetInfo = InferResponseType<typeof api.api.assets.$get>["assets"][number];
export function useWorkspace() { return useQuery({ queryKey: ["workspace", "account"], queryFn: async () => json<WorkspaceInfo>(await api.api.workspace.$get()) }); }
export function useUploadImage() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (file: File) => {
    const data = await optimizeUpload(file);
    return json<{ asset: AssetInfo }>(await api.api.assets.$post({ json: { data, name: file.name.slice(0, 160) } }));
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: ["assets"] }); void client.invalidateQueries({ queryKey: ["workspace", "account"] }); } });
}
