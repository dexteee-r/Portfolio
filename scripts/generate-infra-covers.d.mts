/** Types for the cover generator, so its drawings can be tested (tests/unit/infra-covers.test.ts). */
export const WIDTH: number;
export const HEIGHT: number;
/** Each infra project's cover, as an SVG document. */
export const covers: Record<"homelab" | "supervision" | "acces-distant", () => string>;
