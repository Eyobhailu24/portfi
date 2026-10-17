CREATE TABLE IF NOT EXISTS portfi_workspaces (
  owner_id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portfi_workspace_customer_idx ON portfi_workspaces ((state->>'customerId')) WHERE state->>'customerId' IS NOT NULL;
CREATE TABLE IF NOT EXISTS portfi_revisions (
  project_id uuid NOT NULL REFERENCES portfi_projects(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL DEFAULT 'Saved changes',
  document jsonb NOT NULL,
  PRIMARY KEY(project_id, revision)
);
CREATE INDEX IF NOT EXISTS portfi_revisions_owner_idx ON portfi_revisions(owner_id, project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS portfi_webhook_events (
  provider text NOT NULL,
  id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider, id)
);
CREATE TABLE IF NOT EXISTS portfi_publish_jobs (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  project_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  state jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS portfi_publish_jobs_pending_idx ON portfi_publish_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS portfi_publish_jobs_owner_idx ON portfi_publish_jobs(owner_id, project_id, created_at DESC);
ALTER TABLE portfi_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfi_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfi_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfi_publish_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portfi_workspaces, portfi_revisions, portfi_webhook_events, portfi_publish_jobs FROM PUBLIC;
