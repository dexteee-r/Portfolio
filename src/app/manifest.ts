import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { ICON_SIZES, iconPath } from "@/seo/icons";
import { framePalette } from "@/seo/tokens";
import { site } from "@/site";

/** Home-screen install: opens on the desk, in the frame's own colours. */
export default function manifest(): MetadataRoute.Manifest {
  const frame = framePalette();
  return {
    name: site.brand,
    short_name: site.brand,
    description: getDictionary(defaultLocale).meta.description,
    lang: defaultLocale,
    start_url: homePath(defaultLocale),
    scope: "/",
    display: "standalone",
    background_color: frame.bg,
    theme_color: frame.bg,
    icons: ICON_SIZES.map((size) => ({
      src: iconPath(size),
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
