import { database } from "@/backend/auth";
import { billingReady, reconcileSubscription } from "@/backend/billing/stripe";
import { reapPendingAssets } from "./assets";
import type { Identity } from "./identity";

/** Run hourly from a trusted scheduler. No public maintenance endpoint or secrets
 * in logs. Bounded batches let large installations drain work across runs. */
export async function maintainWorkspaceServices() {
  const db = database();
  if (!db) throw new Error("Configure DATABASE_URL before running maintenance.");
  const report = { expiredRevisions: 0, expiredRateKeys: 0, abandonedUploads: 0, billingAccounts: 0, failures: 0 };
  const revisions = await db.query("DELETE FROM portfi_revisions WHERE ctid IN (SELECT ctid FROM portfi_revisions WHERE created_at < now()-interval '90 days' LIMIT 1000)");
  report.expiredRevisions = revisions.rowCount || 0;
  const rates = await db.query("DELETE FROM portfi_rate_limits WHERE window_key < $1", [Math.floor(Date.now() / 60_000) - 1440]);
  report.expiredRateKeys = rates.rowCount || 0;
  const pending = await db.query("SELECT owner_id FROM portfi_workspaces WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(state->'assets') asset WHERE asset->>'status'='pending' AND (asset->>'createdAt')::timestamptz < now()-interval '2 hours') ORDER BY updated_at LIMIT 100");
  const owner = (id: string): Identity => ({ id, mode: "account", name: "", email: "", verified: true });
  for (const row of pending.rows) {
    try { report.abandonedUploads += await reapPendingAssets(owner(row.owner_id)); }
    catch { report.failures++; }
  }
  if (billingReady()) {
    const stale = await db.query("SELECT owner_id FROM portfi_workspaces WHERE state->>'customerId' IS NOT NULL AND COALESCE((state->'subscription'->>'checkedAt')::timestamptz,updated_at) < now()-interval '1 day' ORDER BY updated_at LIMIT 100");
    for (const row of stale.rows) {
      try { await reconcileSubscription(owner(row.owner_id)); report.billingAccounts++; }
      catch { report.failures++; }
    }
  }
  return report;
}
