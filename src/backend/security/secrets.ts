import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

function key() {
  const value = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return value;
}
export function encryptSecret(value: unknown, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}
export function decryptSecret<T>(value: string, owner: string): T {
  const parts = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error("Invalid encrypted connection.");
  const decipher = createDecipheriv("aes-256-gcm", key(), parts[0]);
  decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(parts[1]);
  return JSON.parse(Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString("utf8")) as T;
}
export function safeEqual(a: string, b: string) {
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
