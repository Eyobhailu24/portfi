import { vi } from "vitest";

if (typeof window !== "undefined") {
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); }, removeItem: (key) => { values.delete(key); }, key: (index) => [...values.keys()][index] ?? null };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
}
