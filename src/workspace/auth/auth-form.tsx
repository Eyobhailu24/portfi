"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Brand } from "@/shared/components/brand";
import { TemplatePreview } from "@/shared/components/template-preview";
import { api, json } from "@/workspace/api/client";

type Mode = "login" | "signup" | "reset" | "verify";
async function authRequest<T>(route: string, body: Record<string, unknown>) {
  return json<T>(await fetch(`/api/auth/${route}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const client = useQueryClient();
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: async () => json<{ auth: boolean; email: boolean; google: boolean; guest: boolean }>(await api.api.capabilities.$get()) });
  const session = useQuery({ queryKey: ["session"], queryFn: async () => json<{ user: { name: string; mode: string } | null }>(await api.api.session.$get()) });
  const auth = useMutation({
    mutationFn: async ({ route, body, submittedMode }: { route: string; body: Record<string, string>; submittedMode: Mode }) => { await authRequest(route, body); return submittedMode; },
    onSuccess: (submittedMode) => {
      if (submittedMode === "login") { client.clear(); router.push("/dashboard"); }
      else setSuccess(submittedMode === "signup" ? "Check your email to verify your account, then come back to sign in." : submittedMode === "verify" ? "If that account needs verification, you’ll receive a new email. Check your inbox and spam folder." : "If an account matches that email, you’ll receive a recovery link.");
    },
  });
  const google = useMutation({
    mutationFn: () => authRequest<{ url?: string }>("sign-in/social", { provider: "google", callbackURL: `${window.location.origin}/dashboard`, errorCallbackURL: `${window.location.origin}/login`, disableRedirect: true }),
    onSuccess: ({ url }) => { if (url) window.location.assign(url); },
  });
  const signOut = useMutation({ mutationFn: () => authRequest("sign-out", {}), onSuccess: () => { client.clear(); router.refresh(); } });
  const busy = auth.isPending || google.isPending;
  function switchMode(next: Mode) { setMode(next); setSuccess(""); auth.reset(); google.reset(); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSuccess("");
    const data = new FormData(event.currentTarget);
    auth.mutate({
      submittedMode: mode,
      route: { login: "sign-in/email", signup: "sign-up/email", reset: "request-password-reset", verify: "send-verification-email" }[mode],
      body: { email: String(data.get("email")),
        ...(mode === "login" || mode === "signup" ? { password: String(data.get("password")) } : {}),
        ...(mode === "reset" ? { redirectTo: `${window.location.origin}/reset-password` } : {}),
        ...(mode === "signup" ? { name: String(data.get("name")) } : {}),
        ...(mode === "signup" || mode === "verify" ? { callbackURL: `${window.location.origin}/login` } : {}),
      },
    });
  }
  return <main id="main-content" className="auth-layout">
    <aside className="auth-aside"><Brand /><div><h2>A little space.<br />A lot of <em>possibility.</em></h2><TemplatePreview template="studio" /></div><p>YOUR WORK DESERVES A BEAUTIFUL HOME.</p></aside>
    <section className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form">
      {session.data?.user?.mode === "account" ? <>
        <span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Hi, {session.data.user.name}.</h1><p>Your next chapter is waiting in your workspace.</p>
        <Link className="button button-blue" href="/dashboard">Open your workspace <ArrowUpRight size={16} /></Link>
        <button className="button button-outline" disabled={signOut.isPending} onClick={() => signOut.mutate()}><LogOut size={15} /> Sign out</button>
        {signOut.isError && <p role="alert" className="error-message">{signOut.error.message}</p>}
      </> : <>
        <h1>{{ login: "Welcome back.", signup: "Your next chapter.", reset: "A fresh start.", verify: "Check your inbox." }[mode]}</h1>
        <p>{{ login: "A little space for your work. And whatever comes next.", signup: "Make a home for your work. Make it yours.", reset: "We’ll help you get back into your workspace.", verify: "Request a new link to verify your email address." }[mode]}</p>
        {success ? <div className="auth-success" role="status">{success}</div> : <form onSubmit={submit}>
          {mode === "signup" && <><label htmlFor="name">Your name</label><input className="text-input" id="name" name="name" autoComplete="name" required maxLength={100} /></>}
          <label htmlFor="email">Email address</label><input className="text-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          {(mode === "login" || mode === "signup") && <><label htmlFor="password">Password</label><input className="text-input" id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} maxLength={128} required /></>}
          {mode === "login" && <button type="button" className="forgot-link" disabled={busy} onClick={() => switchMode("reset")}>Forgot your password?</button>}
          {auth.isError && <p className="error-message" role="alert">{auth.error.message}</p>}
          <button className="button button-blue" disabled={busy || !capabilities.data?.auth || !capabilities.data?.email} type="submit">{auth.isPending ? "One moment…" : { login: "Open your workspace", signup: "Create your account", reset: "Send recovery link", verify: "Resend verification email" }[mode]}<ArrowUpRight size={16} /></button>
        </form>}
        {capabilities.data?.google && capabilities.data.auth && (mode === "login" || mode === "signup") && <button className="button button-outline" disabled={busy} onClick={() => google.mutate()}>{google.isPending ? "Connecting…" : "Continue with Google"}<ArrowUpRight size={16} /></button>}
        {google.isError && <p className="error-message" role="alert">{google.error.message}</p>}
        <p className="auth-switch">{mode === "login" ? "New around here? " : "Already have a space? "}<button className="inline-button" disabled={busy} onClick={() => switchMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Make yourself at home" : "Sign in"}</button></p>
        {mode !== "verify" && <button className="forgot-link" disabled={busy} onClick={() => switchMode("verify")}>Need another verification email?</button>}
        {capabilities.data && !capabilities.data.auth && <div className="auth-preview-note">Account sign-in is ready to connect to your database and email provider. While developing, you can explore the editor in a local workspace.{capabilities.data.guest && <Link href="/dashboard">Explore the local workspace <ArrowUpRight size={14} /></Link>}</div>}
        {capabilities.data?.auth && !capabilities.data.email && <div className="auth-preview-note">Email delivery needs to be connected before email sign-in and verification can be enabled.</div>}
      </>}
    </div></section>
  </main>;
}
