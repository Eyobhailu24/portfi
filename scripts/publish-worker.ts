import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { processPublishJob, publishingReady } from "../src/backend/publishing/jobs";
import { database } from "../src/backend/auth";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!publishingReady()) throw new Error("Configure the database, GitHub App, Vercel integration, encryption key, and PUBLISH_WORKER_ENABLED before running this worker.");
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
console.log("Portfi publish worker started. Waiting for queued jobs.");
try {
  while (!stopping) {
    try { if (!await processPublishJob()) await setTimeout(3000); }
    catch { console.error("Publish worker could not process a job. Check database connectivity; durable jobs will be retried."); await setTimeout(5000); }
    if (process.argv.includes("--once")) break;
  }
} finally { await database()?.end(); }
