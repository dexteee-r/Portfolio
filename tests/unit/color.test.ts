import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/color";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("accepts shorthand and uppercase hex", () => {
    expect(relativeLuminance("#FFF")).toBeCloseTo(relativeLuminance("#ffffff"), 10);
    expect(relativeLuminance("#abc")).toBeCloseTo(relativeLuminance("#aabbcc"), 10);
  });

  it("rejects anything that is not a hex colour", () => {
    expect(() => relativeLuminance("red")).toThrow();
    expect(() => relativeLuminance("#12345")).toThrow();
    expect(() => relativeLuminance("var(--x)")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777", "#fff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#4a55d6", "#f6f6f4")).toBe(contrastRatio("#f6f6f4", "#4a55d6"));
  });
});
