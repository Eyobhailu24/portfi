import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getMigrations } from "better-auth/db/migration";
import { getAuthTables } from "better-auth/db";
import { database, getAuth } from "../src/backend/auth/index";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const pool = database();
const auth = getAuth();
if (!pool || !auth) throw new Error("Set DATABASE_URL and BETTER_AUTH_SECRET in .env.local before running the database migration.");
try {
  const plan = await getMigrations(auth.options);
  if (plan.schemaProblems.length) throw new Error(plan.schemaProblems.join("\n"));
  await plan.runMigrations();
  const directory = new URL("../supabase/migrations/", import.meta.url);
  await pool.query("CREATE TABLE IF NOT EXISTS portfi_schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(hashtext('portfi-schema-migrations'))");
      const applied = await connection.query("SELECT name FROM portfi_schema_migrations WHERE name = $1", [name]);
      if (!applied.rowCount) {
        await connection.query(await readFile(new URL(name, directory), "utf8"));
        await connection.query("INSERT INTO portfi_schema_migrations(name) VALUES($1)", [name]);
      }
      await connection.query("COMMIT");
    } catch (error) { await connection.query("ROLLBACK"); throw error; } finally { connection.release(); }
  }
  // Supabase projects can grant API roles access to new public tables by default.
  // Identity/session tables must be private too, not just Portfi project records.
  const tables = [...new Set([...Object.values(getAuthTables(auth.options)).map((table) => table.modelName), "portfi_projects", "portfi_workspaces", "portfi_revisions", "portfi_webhook_events", "portfi_publish_jobs", "portfi_rate_limits", "portfi_schema_migrations"])];
  const apiRoles = (await pool.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows.map((row) => row.rolname as string);
  for (const table of tables) {
    const quoted = `public."${table.replaceAll('"', '""')}"`;
    await pool.query(`ALTER TABLE ${quoted} ENABLE ROW LEVEL SECURITY`);
    await pool.query(`REVOKE ALL ON TABLE ${quoted} FROM PUBLIC`);
    for (const role of apiRoles) await pool.query(`REVOKE ALL ON TABLE ${quoted} FROM "${role}"`);
  }
  console.log("Portfi account/session, workspace, revision and publishing tables are ready. Public API roles have no table access.");
} finally { await pool.end(); }
