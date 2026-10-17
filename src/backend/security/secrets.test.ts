import { afterEach, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";
afterEach(() => vi.unstubAllEnvs());
it("encrypts tokens with fresh nonces and binds ciphertext to its owner", () => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const value = { access: "private-provider-token", refresh: "private-refresh" };
  const first = encryptSecret(value, "owner-1"); const second = encryptSecret(value, "owner-1");
  expect(first).not.toBe(second); expect(first).not.toContain(value.access);
  expect(decryptSecret(first, "owner-1")).toEqual(value);
  expect(() => decryptSecret(first, "owner-2")).toThrow();
  expect(() => decryptSecret(first.slice(0, -5) + "AAAAA", "owner-1")).toThrow();
});
