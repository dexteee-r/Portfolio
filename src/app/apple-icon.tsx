import { ImageResponse } from "next/og";
import { IconCard } from "@/seo/og/cards";
import { APPLE_ICON_SIZE } from "@/seo/icons";
import { framePalette } from "@/seo/tokens";

export const size = { width: APPLE_ICON_SIZE, height: APPLE_ICON_SIZE };
export const contentType = "image/png";

/** Home-screen icon on iOS: opaque, the system rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(<IconCard palette={framePalette()} size={APPLE_ICON_SIZE} />, size);
}
