import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("image optimisation", () => {
  // The homelab's server optimises each image on its first request, and its
  // cache lives in memory, emptied by every deploy. Measured there on
  // 2026-10-04 for a 750 px cover: WebP 0.16–0.18 s, AVIF 0.52–0.71 s.
  it("serves WebP only: AVIF halves the bytes but makes every first view three to four times slower", () => {
    expect(nextConfig.images?.formats).toEqual(["image/webp"]);
  });
});
