/** Sizes of the generated PNG icon: browser tab, then the two a manifest needs. */
export const ICON_SIZES = [32, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export const APPLE_ICON_SIZE = 180;

/** URL of one generated icon (app/icon.tsx, one image per size). */
export function iconPath(size: IconSize): string {
  return `/icon/${size}`;
}
