CREATE TABLE IF NOT EXISTS portfi_rate_limits (
  key text PRIMARY KEY,
  window_key bigint NOT NULL,
  hits integer NOT NULL
);
ALTER TABLE portfi_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portfi_rate_limits FROM PUBLIC;
