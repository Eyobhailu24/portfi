import { localProjects, type OwnerContext } from "./workspace-store";

export async function documentBytes(context: OwnerContext, except = "00000000-0000-0000-0000-000000000000") {
  if (context.db) return Number((await context.db.query("SELECT COALESCE(sum(octet_length(document::text)),0) AS bytes FROM portfi_projects WHERE owner_id=$1 AND id<>$2", [context.user.id, except])).rows[0].bytes);
  return (await localProjects(context.user)).filter((project) => project.id !== except).reduce((sum, project) => sum + Buffer.byteLength(JSON.stringify(project)), 0);
}
export async function storageBytes(context: OwnerContext) { return await documentBytes(context) + context.state.assets.reduce((sum, asset) => sum + asset.size, 0); }
