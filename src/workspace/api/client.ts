import { hc } from "hono/client";
import type { AppType } from "@/backend/api";

export const api = hc<AppType>("/", { init: { credentials: "same-origin" } });
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
export async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new ApiError(typeof body.error === "string" ? body.error : body.message || body.error?.message || "The request could not be completed.", response.status);
  return body as T;
}
