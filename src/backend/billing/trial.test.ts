import { describe, expect, it } from "vitest";
import { trialEnd } from "./trial";

describe("a calendar-month Creator trial", () => {
  it("clamps January 31 to February's last day without changing the time", () => {
    expect(trialEnd(new Date("2026-01-31T16:45:20Z")).toISOString()).toBe("2026-02-28T16:45:20.000Z");
    expect(trialEnd(new Date("2028-01-31T16:45:20Z")).toISOString()).toBe("2028-02-29T16:45:20.000Z");
  });
  it("handles year boundaries", () => expect(trialEnd(new Date("2026-12-16T12:00:00Z")).toISOString()).toBe("2027-01-16T12:00:00.000Z"));
});
