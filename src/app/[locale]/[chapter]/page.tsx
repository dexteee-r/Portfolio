import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ChapterView } from "@/components/ChapterView";
import { JsonLd } from "@/components/JsonLd";
import { chapterFromSlug, chapterIds, chapterSlugs } from "@/content/chapters";
import { readPlaceholders } from "@/content/media";
import { loadNetwork } from "@/content/network";
import {
  countByChapter,
  loadProjects,
  localizeProject,
  projectsOf,
  visibleProjects,
} from "@/content/projects";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { chapterPath, homePath } from "@/i18n/paths";
import { pageMetadata } from "@/seo/metadata";
import { breadcrumbLd, graph, localBusinessLd } from "@/seo/structured-data";
import { chapterPalette } from "@/seo/tokens";
import { site } from "@/site";

/** Each language gets its own slugs: /fr/creatif, /en/creative. */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  const locale = params.locale;
  return chapterIds.map((id) => ({ chapter: chapterSlugs[id][locale] }));
}

/**
 * A slug from the wrong language, or a made-up one, is never rendered: it
 * falls through to app/global-not-found.tsx, a complete server-rendered 404.
 * (The Node server logs a NoFallbackError for each such request — noise, not
 * a failure; the container's logs are size-capped, see deploy/compose.yaml.)
 */
export const dynamicParams = false;

async function resolve(params: PageProps<"/[locale]/[chapter]">["params"]) {
  const { locale, chapter: slug } = await params;
  if (!isLocale(locale)) return null;
  const chapter = chapterFromSlug(locale, slug);
  return chapter ? { locale, chapter } : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[chapter]">): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return {};
  const { locale, chapter } = resolved;
  const copy = getDictionary(locale).chapters[chapter];
  return pageMetadata({
    locale,
    pathFor: (l) => chapterPath(l, chapter),
    title: copy.name,
    description: copy.description,
  });
}

/** On a phone, the browser's chrome takes the chapter's ground. */
export async function generateViewport({ params }: PageProps<"/[locale]/[chapter]">): Promise<Viewport> {
  const resolved = await resolve(params);
  return resolved ? { themeColor: chapterPalette(resolved.chapter).bg } : {};
}

export default async function ChapterPage({ params }: PageProps<"/[locale]/[chapter]">) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { locale, chapter } = resolved;
  const dict = getDictionary(locale);
  const path = chapterPath(locale, chapter);

  const all = loadProjects();
  const localized = visibleProjects(projectsOf(all, chapter)).map((p) => localizeProject(p, locale));
  // Each cover's blurred preview, shown in its place — on its station and its folder — until it loads.
  const blurs = await readPlaceholders(localized.flatMap((p) => (p.cover ? [p.cover] : [])));
  const stations = localized.map((p) => (p.cover ? { ...p, coverBlur: blurs[p.cover] } : p));

  const structured = graph(
    breadcrumbLd([
      { name: site.brand, path: homePath(locale) },
      { name: dict.chapters[chapter].name, path },
    ]),
    // Reserved for the repair activity; published only once its details exist.
    chapter === "repair" ? localBusinessLd(site.repairBusiness, dict.chapters.repair.description, path) : null,
  );

  return (
    <>
      <JsonLd data={structured} />
      <ChapterView
        locale={locale}
        dict={dict}
        chapter={chapter}
        stations={stations}
        publishedCount={countByChapter(all)[chapter]}
        network={chapter === "infra" ? loadNetwork() : null}
      />
    </>
  );
}
