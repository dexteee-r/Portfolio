import { ImageResponse } from "next/og";
import { chapterFromSlug } from "@/content/chapters";
import { loadProjects, localizeProject, visibleProjects } from "@/content/projects";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CARD_SIZE, PageCard } from "@/seo/og/cards";
import { cardFonts } from "@/seo/og/fonts";
import { chapterPalette } from "@/seo/tokens";
import { site } from "@/site";

export const contentType = "image/png";

function resolve(params: { locale: string; chapter: string; project: string }) {
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const chapter = chapterFromSlug(locale, params.chapter);
  if (!chapter) return null;
  const project = visibleProjects(loadProjects()).find((p) => p.chapter === chapter && p.slug === params.project);
  return project ? { locale, chapter, project: localizeProject(project, locale) } : null;
}

export function generateImageMetadata({ params }: { params: { locale: string; chapter: string; project: string } }) {
  const resolved = resolve(params);
  if (!resolved) return [];
  const chapterName = getDictionary(resolved.locale).chapters[resolved.chapter].name;
  return [
    { id: "card", size: CARD_SIZE, contentType, alt: `${resolved.project.title} — ${chapterName}, ${site.brand}` },
  ];
}

/** A project: its chapter's grade, the chapter in small, the project's title very large. */
export default async function ProjectShareCard({
  params,
}: {
  params: Promise<{ locale: string; chapter: string; project: string }>;
}) {
  const resolved = resolve(await params);
  if (!resolved) return new Response(null, { status: 404 });
  const chapterName = getDictionary(resolved.locale).chapters[resolved.chapter].name;
  return new ImageResponse(
    <PageCard palette={chapterPalette(resolved.chapter)} eyebrow={chapterName} title={resolved.project.title} />,
    { ...CARD_SIZE, fonts: cardFonts() },
  );
}
