import Image from "next/image";
import Link from "next/link";
import { chapterSlugs } from "@/content/chapters";
import type { Dimensions } from "@/content/media";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { chapterPath } from "@/i18n/paths";
import { ProjectBody } from "./ProjectBody";
import { SiteFooter } from "./SiteFooter";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

export interface SiblingLink {
  href: string;
  title: string;
  /** Language the title is written in. */
  lang: Locale;
}

interface ProjectViewProps {
  locale: Locale;
  dict: Dictionary;
  project: LocalizedProject;
  /** Intrinsic sizes of the images inside the text. */
  images: Record<string, Dimensions>;
  previous?: SiblingLink;
  next?: SiblingLink;
}

/**
 * The full reading of a project, in its chapter's grade: context, choices,
 * what got stuck, visuals, and a link when there is one. The station was the
 * trailer; this is the film.
 */
export function ProjectView({ locale, dict, project, images, previous, next }: ProjectViewProps) {
  const chapterHref = chapterPath(locale, project.chapter);
  const folder = chapterSlugs[project.chapter][locale];
  const other = (lang: Locale) => (lang === locale ? undefined : lang);
  const copy = dict.projectPage;

  return (
    <div
      data-view="project"
      data-chapter={project.chapter}
      className="flex min-h-dvh flex-col bg-chapter-bg text-chapter-ink"
    >
      <SkipLink label={dict.skipLink} />
      <TopBar
        locale={locale}
        dict={dict}
        trail={[{ label: folder, href: chapterHref }, { label: project.slug }]}
      />

      <main id="content" className="flex-1 px-gutter pt-12 pb-16 md:pt-20 md:pb-24">
        <article>
          <header className="max-w-content">
            <p className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
              {dict.chapters[project.chapter].name}
              {project.year !== undefined && <> · {project.year}</>}
            </p>
            <div lang={other(project.lang)}>
              <h1
                data-view-title=""
                tabIndex={-1}
                className="mt-3 text-3xl font-semibold leading-tight tracking-display text-chapter-ink hyphens-auto wrap-break-word md:text-4xl"
              >
                {project.title}
              </h1>
              {project.summary && (
                <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">{project.summary}</p>
              )}
            </div>
            {project.links.length > 0 && (
              <ul
                aria-label={copy.linksLabel}
                className="mt-8 flex flex-wrap gap-x-6 gap-y-3 font-mono text-2xs uppercase tracking-label"
              >
                {project.links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} className="text-chapter-accent-text underline-offset-4 hover:underline">
                      {copy.links[link.kind]}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </header>

          {project.cover && (
            <div className="relative mt-12 aspect-[16/10] max-w-content overflow-hidden rounded-sm bg-chapter-surface md:mt-16">
              <Image
                src={project.cover}
                alt={project.coverAlt}
                lang={other(project.lang)}
                fill
                sizes="(min-width: 1024px) 64rem, 100vw"
                className="object-cover"
                loading="eager"
                fetchPriority="high"
              />
            </div>
          )}

          {project.body.trim() && (
            <div lang={other(project.bodyLang)} className="mt-12 md:mt-16">
              <ProjectBody markdown={project.body} images={images} />
            </div>
          )}
        </article>

        {(previous || next) && (
          <nav
            aria-label={copy.siblingsLabel}
            className="mt-20 grid max-w-content gap-8 border-t border-chapter-line pt-8 md:mt-24 md:grid-cols-2"
          >
            {previous && (
              <Link href={previous.href} rel="prev" className="group flex flex-col gap-2">
                <span className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
                  <span aria-hidden="true">← </span>
                  {copy.previous}
                </span>
                <span lang={other(previous.lang)} className="text-xl font-medium text-chapter-ink group-hover:underline">
                  {previous.title}
                </span>
              </Link>
            )}
            {next && (
              <Link
                href={next.href}
                rel="next"
                className="group flex flex-col gap-2 md:col-start-2 md:items-end md:text-right"
              >
                <span className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
                  {copy.next}
                  <span aria-hidden="true"> →</span>
                </span>
                <span lang={other(next.lang)} className="text-xl font-medium text-chapter-ink group-hover:underline">
                  {next.title}
                </span>
              </Link>
            )}
          </nav>
        )}
      </main>

      <SiteFooter
        locale={locale}
        dict={dict}
        back={
          <>
            <Link href={chapterHref} className="text-chapter-ink hover:underline">
              <span aria-hidden="true">← </span>
              {copy.backToChapter}
            </Link>
            <span aria-hidden="true" className="hidden pointer-fine:inline">
              {" · "}
              <kbd className="font-mono">{dict.chapterPage.escapeHint}</kbd>
            </span>
          </>
        }
      />
    </div>
  );
}
