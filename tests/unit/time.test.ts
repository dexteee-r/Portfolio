import { describe, expect, it } from "vitest";
import { clockDateTime, formatClock } from "@/lib/time";

const BRUSSELS = "Europe/Brussels";

describe("formatClock", () => {
  it("shows Brussels time in summer (UTC+2)", () => {
    expect(formatClock(new Date("2026-07-01T08:05:00Z"), "fr", BRUSSELS)).toBe("10:05");
  });

  it("shows Brussels time in winter (UTC+1)", () => {
    expect(formatClock(new Date("2026-01-15T08:05:00Z"), "fr", BRUSSELS)).toBe("09:05");
  });

  it("is 24-hour with a leading zero past midnight, in both locales", () => {
    const lateNight = new Date("2026-01-15T23:30:00Z");
    expect(formatClock(lateNight, "fr", BRUSSELS)).toBe("00:30");
    expect(formatClock(lateNight, "en", BRUSSELS)).toBe("00:30");
  });

  it("follows the daylight-saving switch", () => {
    // 29 March 2026, 01:00 UTC: clocks jump from 02:00 to 03:00 in Brussels.
    expect(formatClock(new Date("2026-03-29T00:59:00Z"), "fr", BRUSSELS)).toBe("01:59");
    expect(formatClock(new Date("2026-03-29T01:00:00Z"), "fr", BRUSSELS)).toBe("03:00");
  });

  it("does not depend on the machine's own time zone", () => {
    const date = new Date("2026-07-01T12:00:00Z");
    expect(formatClock(date, "fr", "UTC")).toBe("12:00");
    expect(formatClock(date, "fr", BRUSSELS)).toBe("14:00");
  });
});

describe("clockDateTime", () => {
  it("is a valid HH:MM value for the time element", () => {
    expect(clockDateTime(new Date("2026-07-01T08:05:00Z"), BRUSSELS)).toMatch(/^\d{2}:\d{2}$/);
  });
});
