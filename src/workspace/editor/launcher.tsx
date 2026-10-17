"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/shared/components/brand";
import { api, json } from "@/workspace/api/client";
import type { Project, TemplateId } from "@/shared/portfolio/schema";

export function EditorLauncher({ template }: { template: TemplateId }) {
  const router = useRouter();
  const started = useRef(false);
  const create = useMutation({ mutationFn: async () => json<{ project: Project }>(await api.api.projects.$post({ json: { template } })), onSuccess: ({ project }) => router.replace(`/editor/${project.id}`) });
  useEffect(() => { if (!started.current) { started.current = true; create.mutate(); } }, [create.mutate]);
  return <main id="main-content" className="loading-screen"><Brand/>{create.isError ? <><p>{create.error.message}</p><Link href="/dashboard" className="button button-blue">Open your workspace</Link><Link href="/login" className="text-link">Sign in</Link></> : <><span className="loading-spinner"/><p>Making a little space for your work…</p></>}</main>;
}
