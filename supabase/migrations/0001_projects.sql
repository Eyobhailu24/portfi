CREATE TABLE IF NOT EXISTS portfi_projects (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfi_projects_owner_idx ON portfi_projects(owner_id, updated_at DESC);
ALTER TABLE portfi_projects ENABLE ROW LEVEL SECURITY;
-- Application records are accessed only through the authorized Hono backend.
REVOKE ALL ON portfi_projects FROM PUBLIC;
