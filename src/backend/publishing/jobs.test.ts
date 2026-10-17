import JSZip from "jszip";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProject } from "@/shared/portfolio/schema";
const mocks = vi.hoisted(() => ({ query: vi.fn(), deploy: vi.fn(), findDeployment: vi.fn(), status: vi.fn(), cancel: vi.fn() }));
vi.mock("@/backend/auth", () => ({ database: () => ({ query: mocks.query }) }));
vi.mock("./connections", () => ({ providerReady: () => true }));
vi.mock("@/backend/services/projects", () => ({ authorizeExport: vi.fn(), readInContext: vi.fn() }));
vi.mock("@/backend/services/workspace-store", () => ({ withOwner: async (_user: unknown, callback: (context: unknown) => unknown) => callback({}) }));
vi.mock("@/backend/billing/entitlements", () => ({ checkDocument: vi.fn() }));
vi.mock("@/backend/services/assets", () => ({ portableAssets: async (_user: unknown, project: unknown) => ({ project, files: [] }) }));
vi.mock("./exporter", () => ({ exportProject: async () => new JSZip().file("package.json", "{}").generateAsync({ type: "nodebuffer" }) }));
vi.mock("./providers", async (original) => ({ ...await original<typeof import("./providers")>(), githubClient: async () => ({}), vercelClient: async () => ({ deploy: mocks.deploy, findDeployment: mocks.findDeployment, status: mocks.status, cancel: mocks.cancel }) }));
import { processPublishJob } from "./jobs";

let job: { id: string; owner_id: string; project_id: string; status: string; state: Record<string, unknown>; attempts: number; lease_token: string };
beforeEach(() => {
  vi.stubEnv("PUBLISH_WORKER_ENABLED", "true");
  vi.clearAllMocks();
  const project = createProject();
  job = { id: crypto.randomUUID(), owner_id: "owner", project_id: project.id, status: "running", state: { project, repositoryName: "portfolio", repository: { id: 1, full_name: "owner/portfolio", default_branch: "main" }, commit: "commit", vercelProject: { id: "prj_test", name: "portfolio" }, deploymentSubmitted: true, createdAt: new Date().toISOString() }, attempts: 1, lease_token: crypto.randomUUID() };
  mocks.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes("RETURNING *")) return { rows: [structuredClone(job)], rowCount: 1 };
    if (sql.startsWith("SELECT state")) return { rows: [{ state: job.state }], rowCount: 1 };
    if (sql.includes("jsonb_build_object")) { job.status = values[1] as string; job.state = JSON.parse(values[0] as string); return { rows: [{ id: job.id }], rowCount: 1 }; }
    return { rows: [], rowCount: 1 };
  });
});
afterEach(() => vi.unstubAllEnvs());

it("reconciles an uncertain Vercel request without creating another deployment", async () => {
  mocks.findDeployment.mockResolvedValue(null);
  await processPublishJob();
  expect(mocks.deploy).not.toHaveBeenCalled(); expect(job.status).toBe("retrying");
  expect(job.state.message).toMatch(/not create a second deployment/);
});
it("recovers the provider deployment by job metadata and finishes the same job", async () => {
  const deployment = { id: "dpl_recovered", url: "portfolio.vercel.app", readyState: "READY" };
  mocks.findDeployment.mockResolvedValue(deployment); mocks.status.mockResolvedValue(deployment);
  await processPublishJob();
  expect(mocks.deploy).not.toHaveBeenCalled(); expect(job.status).toBe("succeeded");
  expect(job.state.deployment).toEqual(deployment);
});

it("cancels a recovered in-flight deployment rather than silently abandoning it", async () => {
  job.state.cancelRequested = true;
  const deployment = { id: "dpl_waiting", url: "portfolio.vercel.app", readyState: "BUILDING" };
  mocks.findDeployment.mockResolvedValue(deployment); mocks.status.mockResolvedValue(deployment); mocks.cancel.mockResolvedValue({});
  await processPublishJob();
  expect(mocks.cancel).toHaveBeenCalledWith(deployment.id);
  expect(mocks.deploy).not.toHaveBeenCalled(); expect(job.status).toBe("canceled");
});

it("keeps cancellation pending when the provider cannot confirm it", async () => {
  job.state.cancelRequested = true;
  mocks.findDeployment.mockResolvedValue(null);
  await processPublishJob();
  expect(job.status).toBe("retrying"); expect(job.state.message).toMatch(/not confirmed cancellation/);
});

it("reports a deployment that went live before cancellation honestly", async () => {
  job.state.cancelRequested = true;
  const deployment = { id: "dpl_live", url: "portfolio.vercel.app", readyState: "READY" };
  mocks.findDeployment.mockResolvedValue(deployment); mocks.status.mockResolvedValue(deployment);
  await processPublishJob();
  expect(mocks.cancel).not.toHaveBeenCalled(); expect(job.status).toBe("succeeded");
  expect(job.state.message).toMatch(/went live before/);
});
