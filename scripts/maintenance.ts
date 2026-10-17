import { existsSync } from "node:fs";
import { database } from "../src/backend/auth";
import { maintainWorkspaceServices } from "../src/backend/services/maintenance";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
try {
  const report = await maintainWorkspaceServices();
  console.log(JSON.stringify({ task: "Portfi maintenance", ...report }));
  if (report.failures) process.exitCode = 1;
} catch {
  console.error("Maintenance failed. Check service configuration and database connectivity.");
  process.exitCode = 1;
} finally { await database()?.end(); }
