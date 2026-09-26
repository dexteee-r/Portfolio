import type { MetadataRoute } from "next";
import { loadProjects } from "@/content/projects";
import { sitemapEntries } from "@/seo/sitemap";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(loadProjects());
}
