import type { MetadataRoute } from "next";
import { isIndexable } from "@/seo/metadata";
import { robotsRules } from "@/seo/sitemap";

export default function robots(): MetadataRoute.Robots {
  return robotsRules(isIndexable());
}
