import Image from "next/image";
import Link from "next/link";
import { chapterSlugs } from "@/content/chapters";
import type { Dimensions } from "@/content/media";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { chapterPath } from "@/i18n/paths";
import { site } from "@/site";
import { DiagnosticScan } from "./DiagnosticScan";
import { Floppy } from "./Floppy";
import { ProjectBody } from "./ProjectBody";
import { hasTicket, RepairTicket } from "./RepairTicket";
import { SiteFooter } from "./SiteFooter";
import { SkipLink } from "./SkipLink";
import { SpecSheet } from "./SpecSheet";
import { TopBar } from "./TopBar";
import { VhsJacket } from "./VhsJacket";

/** The cover's `sizes`, shared with the VHS jacket's box art: one file for both. */
const COVER_SIZES = "(min-width: 1024px) 64rem, 100vw";

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
  /** Intrinsic sizes of the images inside the text, and of the cover. */
  images: Record<string, Dimensions>;
  previous?: SiblingLink;
  next?: SiblingLink;
  /** Its place in the chapter, 1-based: disk 1 of 4, ticket No. 01. */
  place?: { number: number; total: number };
}

/**
 * How the header makes room for its chapter's object.
 * - floppy, jacket: on a phone, the text, then the object beside its sheet;
 *   on a wide screen, the object on the right, the sheet under the text.
 * - ticket: under the text on a phone, on the right on a wide screen.
 */
const HEADER_LAYOUT = {
  floppy: {
    header:
      "grid max-w-content grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-5 gap-y-10 sm:grid-cols-[10rem_minmax(0,1fr)] md:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-16",
    text: "col-span-2 min-w-0 lg:col-span-1",
  },
  // Narrower columns: a jacket stands taller than it is wide.
  jacket: {
    header:
      "grid max-w-content grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-5 gap-y-10 sm:grid-cols-[9rem_minmax(0,1fr)] md:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-x-16",
    text: "col-span-2 min-w-0 lg:col-span-1",
  },
  ticket: {
    header: "grid max-w-content items-start gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-16",
    text: "min-w-0",
  },
} as const;

/**
 * The full reading of a project, in its chapter's grade: context, choices,
 * what got stuck, visuals, and a link when there is one. The station was the
 * trailer; this is the film.
 */
export function ProjectView({ locale, dict, project, images, previous, next, place }: ProjectViewProps) {
  const chapterHref = chapterPath(locale, project.chapter);
  const folder = chapterSlugs[project.chapter][locale];
  const other = (lang: Locale) => (lang === locale ? undefined : lang);
  const copy = dict.projectPage;
  // Each chapter's object at the head of its projects: dev's floppy disk, with
  // its spec sheet; repair's ticket, once there is something to print on it;
  // creative's VHS jacket, with its credits.
  const object =
    project.chapter === "dev"
      ? "floppy"
      : project.chapter === "creative"
        ? "jacket"
        : project.chapter === "repair" && hasTicket(project)
          ? "ticket"
          : null;
  const layout = object ? HEADER_LAYOUT[object] : null;
  // Repair's effect: the parts it names, boxed on the cover by a diagnostic
  // scan — drawn at the photo's own proportions, so it needs to know them.
  const scanSize =
    project.chapter === "repair" && project.scan.length > 0 && project.cover ? images[project.cover] : undefined;

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
          <header className={layout?.header ?? "max-w-content"}>
            <div className={layout?.text}>
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
            </div>
            {object === "floppy" && (
              <>
                <Floppy
                  brand={site.brand}
                  title={project.title}
                  lang={other(project.lang)}
                  slug={project.slug}
                  year={project.year}
                  disk={place}
                  className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
                />
                <SpecSheet
                  copy={copy.specs}
                  locale={locale}
                  year={project.year}
                  role={project.role}
                  roleLang={other(project.roleLang)}
                  stack={project.stack}
                  className="lg:col-start-1 lg:row-start-2"
                />
              </>
            )}
            {object === "jacket" && (
              <>
                <VhsJacket
                  brand={site.brand}
                  label={dict.chapters.creative.name}
                  title={project.title}
                  lang={other(project.lang)}
                  locale={locale}
                  slug={project.slug}
                  year={project.year}
                  duration={project.duration}
                  cover={project.cover}
                  coverSizes={COVER_SIZES}
                  className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
                />
                <SpecSheet
                  copy={copy.credits}
                  locale={locale}
                  year={project.year}
                  role={project.role}
                  roleLang={other(project.roleLang)}
                  duration={project.duration}
                  stack={project.stack}
                  className="lg:col-start-1 lg:row-start-2"
                />
              </>
            )}
            {object === "ticket" && (
              <RepairTicket
                copy={copy.ticket}
                locale={locale}
                brand={site.brand}
                slug={project.slug}
                device={project.device}
                role={project.role}
                roleLang={other(project.roleLang)}
                duration={project.duration}
                year={project.year}
                number={place?.number}
                className="w-full max-w-xs lg:max-w-none"
              />
            )}
            {/* The infra chapter's effect is its network map; its projects keep a plain spec sheet. */}
            {project.chapter === "infra" && (
              <SpecSheet
                copy={copy.specs}
                locale={locale}
                year={project.year}
                role={project.role}
                roleLang={other(project.roleLang)}
                stack={project.stack}
                className="mt-10"
              />
            )}
          </header>

          {project.cover && scanSize && (
            <DiagnosticScan
              cover={project.cover}
              alt={project.coverAlt}
              lang={other(project.lang)}
              size={scanSize}
              sizes={COVER_SIZES}
              markers={project.scan}
              markersLang={other(project.scanLang)}
              copy={copy.scan}
              className="mt-12 max-w-content md:mt-16"
            />
          )}
          {project.cover && !scanSize && (
            <div className="relative mt-12 aspect-[16/10] max-w-content overflow-hidden rounded-sm bg-chapter-surface md:mt-16">
              <Image
                src={project.cover}
                alt={project.coverAlt}
                lang={other(project.lang)}
                fill
                sizes={COVER_SIZES}
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
