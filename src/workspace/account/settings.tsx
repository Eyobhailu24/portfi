"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { ArrowLeft, ArrowUpRight, Check, Github, Globe2, Info, LogOut, RefreshCw } from "lucide-react";
import { Brand } from "@/shared/components/brand";
import { plans } from "@/shared/plans/plans";
import { api, json } from "@/workspace/api/client";
import { useWorkspace } from "@/workspace/api/workspace";

type Connections = InferResponseType<typeof api.api.connections.$get>;
export function AccountSettings() {
  const client = useQueryClient();
  const workspace = useWorkspace();
  const session = useQuery({ queryKey: ["session"], queryFn: async () => json<{ user: { name: string; email: string; mode: string } | null }>(await api.api.session.$get()) });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: async () => json<{ auth: boolean; email: boolean; storage: boolean; publishing: boolean; billing: boolean }>(await api.api.capabilities.$get()) });
  const connections = useQuery({ queryKey: ["connections"], queryFn: async () => json<Connections>(await api.api.connections.$get()) });
  const connect = useMutation({ mutationFn: async (provider: "github" | "vercel") => json<{ url: string }>(await api.api.connections[":provider"].connect.$post({ param: { provider } })), onSuccess: ({ url }) => window.location.assign(url) });
  const disconnect = useMutation({ mutationFn: async (provider: "github" | "vercel") => json(await api.api.connections[":provider"].$delete({ param: { provider } })), onSuccess: () => { void client.invalidateQueries({ queryKey: ["connections"] }); } });
  const checkout = useMutation({ mutationFn: async (plan: "creator" | "pro") => json<{ url: string }>(await api.api.billing.checkout.$post({ json: { plan } })), onSuccess: ({ url }) => window.location.assign(url) });
  const portal = useMutation({ mutationFn: async () => json<{ url: string }>(await api.api.billing.portal.$post()), onSuccess: ({ url }) => window.location.assign(url) });
  const sync = useMutation({ mutationFn: async () => json(await api.api.billing.sync.$post()), onSuccess: () => { void client.invalidateQueries({ queryKey: ["workspace", "account"] }); } });
  const signOut = useMutation({ mutationFn: async () => json(await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })), onSuccess: () => { client.clear(); window.location.assign("/login"); } });
  const error = connect.error || disconnect.error || checkout.error || portal.error || sync.error || signOut.error;
  const account = session.data?.user?.mode === "account";

  return <>
    <header className="workspace-header"><Brand /><Link href="/dashboard" className="text-link"><ArrowLeft size={15} /> Your workspace</Link></header>
    <main id="main-content" className="workspace-shell account-settings">
      <div className="workspace-title"><div><span className="eyebrow">YOUR SPACE, YOUR CONNECTIONS</span><h1>Make yourself at home.</h1><p>{session.data?.user?.email || "Local development workspace"}</p></div>{account ? <button className="button button-outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}><LogOut size={15} /> Sign out</button> : <Link href="/login" className="button button-blue">Sign in <ArrowUpRight size={15} /></Link>}</div>
      {!account && <div className="workspace-note"><Info size={16} /><span>Local preview includes the editor and file-based storage. Connect a real account after filling the database and email settings to activate your card-free Creator month and provider connections.</span></div>}
      {workspace.isError && <p className="error-message" role="alert">{workspace.error.message}</p>}
      {error && <p className="error-message" role="alert">{error.message}</p>}
      <section className="settings-section"><div><span className="eyebrow">A LITTLE ROOM TO GROW</span><h2>Your plan.</h2><p>{workspace.data?.plan.source === "trial" ? `Your Creator trial ends ${new Date(workspace.data.plan.trialEndsAt!).toLocaleDateString()}. No card is required and you will not be charged automatically.` : workspace.data?.plan.source === "subscription" ? "Your subscription is managed securely through Stripe." : account ? "Free is a permanent place for your work." : "You’re using the local preview allowance."}</p></div>
        <div className="settings-usage"><span><b>{workspace.data?.plan.source === "preview" ? "Local preview" : workspace.data?.plan.name || "Loading…"}</b></span><span>{workspace.data?.usage.activePortfolios || 0} / {workspace.data?.plan.portfolios || "—"} active portfolios</span><span>{Math.round((workspace.data?.usage.storageBytes || 0) / 1024 / 1024)} MB / {workspace.data?.plan.storageMB || "—"} MB media</span></div>
        <div className="settings-plan-grid">{plans.map((plan) => <article key={plan.id}><h3>{plan.name}</h3><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul>{plan.id === "free" ? <span className="settings-muted">Always available. Cancel a subscription in the billing portal to return to Free after its paid period.</span> : <button className="button button-outline" disabled={!account || !capabilities.data?.billing || checkout.isPending || Boolean(workspace.data?.subscription && ["active", "trialing", "past_due", "unpaid"].includes(workspace.data.subscription.status))} onClick={() => checkout.mutate(plan.id)}>Choose {plan.name} <ArrowUpRight size={14} /></button>}</article>)}</div>
        <p className="settings-muted">Stripe displays the configured price and billing interval before payment. Pricing stays configurable through your Stripe Price IDs.</p>
        {account && <div className="settings-button-row"><button className="button button-outline" disabled={!capabilities.data?.billing || portal.isPending} onClick={() => portal.mutate()}>Manage billing <ArrowUpRight size={14} /></button><button className="button button-outline" disabled={!capabilities.data?.billing || sync.isPending} onClick={() => sync.mutate()}><RefreshCw size={14} /> Refresh subscription</button></div>}
      </section>
      <section className="settings-section"><div><span className="eyebrow">MADE HERE. OWNED BY YOU.</span><h2>Publishing connections.</h2><p>Portfi writes a dedicated portfolio repository in your GitHub and deploys matching source into your Vercel account. Provider charges and domain settings stay with those providers.</p></div>
        <div className="settings-connections">{(["github", "vercel"] as const).map((provider) => {
          const connection = connections.data?.[provider];
          const configured = connections.data?.configured[provider];
          return <article key={provider}><div>{provider === "github" ? <Github size={23} /> : <Globe2 size={23} />}<h3>{provider === "github" ? "GitHub" : "Vercel"}</h3><span>{connection ? `Connected as ${connection.account}` : configured ? "Ready to connect" : "Environment setup required"}</span></div><div className="settings-button-row"><button className="button button-outline" disabled={!account || !configured || connect.isPending} onClick={() => connect.mutate(provider)}>{connection ? "Reconnect" : "Connect"} <ArrowUpRight size={14} /></button>{connection && <button className="button button-outline" disabled={disconnect.isPending} onClick={() => disconnect.mutate(provider)}>Disconnect</button>}</div></article>;
        })}</div>
        {connections.data?.installUrl && <p className="settings-muted"><a className="text-link" href={connections.data.installUrl} target="_blank" rel="noreferrer">Install or manage the GitHub App <ArrowUpRight size={13} /></a> Grant access only to your portfolio repositories. Newly created repositories may need to be added to the installation before publishing can continue.</p>}
        <p className="settings-muted">Disconnecting removes Portfi’s stored connection and stops queued jobs. Your repositories and live websites remain in your accounts. Revoke provider permissions in GitHub/Vercel settings if you also want to uninstall the integration.</p>
      </section>
      <section className="settings-section"><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Service readiness.</h2><p>Fill the placeholders in .env.local, run the setup check and database migration, then start the publishing worker.</p></div><div className="settings-readiness">{[{ name: "Account database", ready: capabilities.data?.auth }, { name: "Verification and recovery email", ready: capabilities.data?.email }, { name: "Private media storage", ready: capabilities.data?.storage }, { name: "Stripe billing", ready: capabilities.data?.billing }, { name: "Publishing configuration", ready: capabilities.data?.publishing }].map((service) => <div key={service.name}><span>{service.name}</span><b>{service.ready ? "Settings present" : "Needs setup"}</b></div>)}</div><p className="settings-muted">These indicators check settings, not provider connectivity. Complete the documented account, payment, and deployment tests after configuration.</p></section>
    </main>
  </>;
}
