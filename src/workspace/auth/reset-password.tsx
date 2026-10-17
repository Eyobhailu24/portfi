"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent } from "react";
import { Brand } from "@/shared/components/brand";
import { json } from "@/workspace/api/client";

export function ResetPassword({ token }: { token?: string }) {
  const mutation = useMutation({ mutationFn: async (password: string) => json(await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: password, token }) })) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); mutation.mutate(String(new FormData(event.currentTarget).get("password"))); }
  return <main id="main-content" className="auth-main" style={{ minHeight: "100dvh" }}><div className="auth-mobile-brand" style={{ display: "block" }}><Brand/></div><div className="auth-form"><h1>A fresh start.</h1>{!token ? <><p>This recovery link is incomplete. Request a new one to get back into your workspace.</p><Link href="/login" className="button button-blue">Back to sign-in</Link></> : mutation.isSuccess ? <><p className="auth-success">Your password has been updated. You can sign in with your new password.</p><Link href="/login" className="button button-blue">Back to sign-in</Link></> : <><p>Choose a new password for your Portfi workspace.</p><form onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" className="text-input" autoComplete="new-password" minLength={8} maxLength={128} required/>{mutation.isError && <p className="error-message">{mutation.error.message}</p>}<button type="submit" className="button button-blue" disabled={mutation.isPending}>{mutation.isPending ? "Updating…" : "Set your new password"}</button></form></>}</div></main>;
}
