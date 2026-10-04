import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProjectView, type SiblingLink } from "@/components/ProjectView";
import { chapterFromSlug, chapterSlugs } from "@/content/chapters";
import { inspectMarkdown } from "@/content/markdown";
import { readImages } from "@/content/media";
import { loadProjects, localizeProject, projectsOf, visibleProjects } from "@/content/projects";
import type { Project } from "@/content/schema";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { chapterPath, homePath, projectPath } from "@/i18n/paths";
import { pageMetadata } from "@/seo/metadata";
import { breadcrumbLd, graph, projectLd } from "@/seo/structured-data";
import { chapterPalette } from "@/seo/tokens";
import { site } from "@/site";

/** Every visible project, in every language, under its chapter's translated slug. */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  const locale = params.locale;
  return visibleProjects(loadProjects()).map((project) => ({
    chapter: chapterSlugs[project.chapter][locale],
    project: project.slug,
  }));
}

/** A draft in production, a removed project, a wrong chapter: the global 404. */
export const dynamicParams = false;

async function resolve(params: PageProps<"/[locale]/[chapter]/[project]">["params"]) {
  const { locale, chapter: chapterSlug, project: slug } = await params;
  if (!isLocale(locale)) return null;
  const chapter = chapterFromSlug(locale, chapterSlug);
  if (!chapter) return null;
  const siblings = visibleProjects(projectsOf(loadProjects(), chapter));
  const index = siblings.findIndex((p) => p.slug === slug);
  if (index === -1) return null;
  return {
    locale,
    project: siblings[index]!,
    previous: siblings[index - 1],
    next: siblings[index + 1],
    place: { number: index + 1, total: siblings.length },
  };
}

function sibling(project: Project | undefined, locale: Locale): SiblingLink | undefined {
  if (!project) return undefined;
  const localized = localizeProject(project, locale);
  return { href: projectPath(locale, project.chapter, project.slug), title: localized.title, lang: localized.lang };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[chapter]/[project]">): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return {};
  const { locale, project } = resolved;
  const localized = localizeProject(project, locale);
  return pageMetadata({
    locale,
    pathFor: (l) => projectPath(l, project.chapter, project.slug),
    title: localized.title,
    // A draft may have no summary yet; its chapter describes it meanwhile.
    description: localized.summary || getDictionary(locale).chapters[project.chapter].description,
    type: "article",
  });
}

/** On a phone, the browser's chrome takes the chapter's ground. */
export async function generateViewport({ params }: PageProps<"/[locale]/[chapter]/[project]">): Promise<Viewport> {
  const resolved = await resolve(params);
  return resolved ? { themeColor: chapterPalette(resolved.project.chapter).bg } : {};
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/[chapter]/[project]">) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { locale, project, previous, next, place } = resolved;
  const dict = getDictionary(locale);
  const path = projectPath(locale, project.chapter, project.slug);

  const localized = localizeProject(project, locale);
  // Their sizes, so nothing shifts, and their blurred previews, so nothing is blank while they load.
  const images = await readImages([
    ...inspectMarkdown(localized.body).images.map((image) => image.url),
    // The diagnostic scan draws the cover at its own proportions.
    ...(localized.cover ? [localized.cover] : []),
  ]);

  const structured = graph(
    breadcrumbLd([
      { name: site.brand, path: homePath(locale) },
      { name: dict.chapters[project.chapter].name, path: chapterPath(locale, project.chapter) },
      { name: localized.title, path },
    ]),
    projectLd(localized, path),
  );

  return (
    <>
      <JsonLd data={structured} />
      <ProjectView
        locale={locale}
        dict={dict}
        project={localized}
        images={images}
        previous={sibling(previous, locale)}
        next={sibling(next, locale)}
        place={place}
      />
    </>
  );
}
