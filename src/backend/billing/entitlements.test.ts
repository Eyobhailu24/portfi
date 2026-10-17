import { expect, it } from "vitest";
import { checkDocument, entitlements, reserveProject } from "./entitlements";
import type { OwnerContext, WorkspaceState } from "@/backend/services/workspace-store";
import { createProject, newBlock } from "@/shared/portfolio/schema";

function context(): OwnerContext {
  const state: WorkspaceState = { version: 1, createdAt: "2026-01-01T00:00:00Z", trial: { startedAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" }, subscription: null, metadata: {}, assets: [], sections: [], connections: {} };
  return { user: { id: "account", mode: "account", name: "Test", email: "test@example.com", verified: true }, db: null, state };
}
it("resolves paid access, trial access, and Free without extending an expired grant", () => {
  const owner = context();
  expect(entitlements(owner, Date.parse("2026-01-15T00:00:00Z")).id).toBe("creator");
  expect(entitlements(owner, Date.parse("2026-02-01T00:00:00Z")).id).toBe("free");
  owner.state.subscription = { plan: "pro", status: "active", customerId: "cus_test", subscriptionId: "sub_test", checkedAt: "2026-01-15T00:00:00Z", accessUntil: "2026-03-01T00:00:00Z" };
  expect(entitlements(owner, Date.parse("2026-01-15T00:00:00Z")).id).toBe("pro");
  expect(entitlements(owner, Date.parse("2026-03-02T00:00:00Z")).id).toBe("free");
  expect(owner.state.trial?.endsAt).toBe("2026-02-01T00:00:00Z");
});
it("retains oversized documents after downgrade while refusing growth and incompatible exports", () => {
  const owner = context(); const project = createProject();
  project.pages.push({ ...structuredClone(project.pages[1]), id: crypto.randomUUID(), slug: "extra" }, { ...structuredClone(project.pages[1]), id: crypto.randomUUID(), slug: "more" });
  expect(() => checkDocument(owner, project, project)).not.toThrow();
  expect(() => checkDocument(owner, project, undefined, true)).toThrow(/3 pages/);
  expect(() => reserveProject(owner, [project.id])).toThrow(/active portfolios/);
  owner.state.metadata[project.id] = { archivedAt: new Date().toISOString(), trashedAt: null, updatedAt: new Date().toISOString() };
  expect(() => reserveProject(owner, [project.id])).not.toThrow();
});
it("checks premium settings inside guided columns too", () => {
  const owner = context(); const project = createProject();
  const columns = newBlock("Columns"); columns.props.columnsContent[0].content.responsive.mobile = { fontSize: 42 };
  project.pages[0].blocks.push(columns);
  expect(() => checkDocument(owner, project, undefined, true)).toThrow(/Creator features/);
});
