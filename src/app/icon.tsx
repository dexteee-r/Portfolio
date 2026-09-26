import { ImageResponse } from "next/og";
import { IconCard } from "@/seo/og/cards";
import { ICON_SIZES } from "@/seo/icons";
import { framePalette } from "@/seo/tokens";

export const contentType = "image/png";

/** One PNG per size: the browser tab, and the two sizes the manifest needs. */
export function generateImageMetadata() {
  return ICON_SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<IconCard palette={framePalette()} size={size} />, { width: size, height: size });
}
