import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { projectPath } from "@/i18n/paths";
import { durationDateTime, formatDuration } from "@/lib/time";
import { Barcode } from "../Barcode";
import { FolderGlyph } from "../FolderGlyph";
import { blurPlaceholder } from "../placeholder";
import { StationPreview } from "../StationPreview";

/** Each order hangs a little askew on its pin: never twice the same way in a row. */
export const TILTS = [-1.6, 1.1, -0.7, 1.9, -1.2, 0.8] as const;

export function tiltOf(index: number): number {
  return TILTS[index % TILTS.length]!;
}

interface WorkOrderProps {
  locale: Locale;
  dict: Dictionary;
  project: LocalizedProject;
  index: number;
}

/**
 * One intervention on the workbench's board: a work order pinned to the
 * pegboard — its number, the photo, the device, what was done, how long,
 * when, and the summary. The whole order is one link, carried by its title.
 * Printed on the chapter's paper (its ink), in its ground's dark.
 */
export function WorkOrder({ locale, dict, project, index }: WorkOrderProps) {
  const ticket = dict.projectPage.ticket;
  const first = index === 0;
  const roleLang = project.roleLang === locale ? undefined : project.roleLang;

  return (
    <article
      lang={project.lang === locale ? undefined : project.lang}
      data-station={project.slug}
      className="work-order group relative"
      style={{ "--tilt": `${tiltOf(index)}deg` } as CSSProperties}
    >
      <span aria-hidden="true" className="work-order-pin" />
      <div className="work-order-paper bg-chapter-ink px-4 pt-4 pb-3 text-chapter-bg">
        <p
          aria-hidden="true"
          className="flex items-baseline justify-between gap-3 border-b border-dashed border-chapter-muted pb-2 font-mono text-2xs uppercase tracking-label"
        >
          <span>ELMZN · {ticket.workshop}</span>
          <span>
            {ticket.number} {String(index + 1).padStart(3, "0")}
          </span>
        </p>

        <div className="relative mt-3 aspect-[4/3] overflow-hidden bg-chapter-bg">
          {project.cover ? (
            <Image
              src={project.cover}
              alt={project.coverAlt}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw"
              className="object-cover transition-transform duration-(--duration-slow) ease-standard group-hover:scale-[1.03]"
              loading={first ? "eager" : "lazy"}
              {...blurPlaceholder(project.coverBlur)}
            />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <FolderGlyph className="w-12 text-chapter-accent" />
            </span>
          )}
          {project.cover && project.preview && (
            <StationPreview
              src={project.preview}
              label={dict.chapterPage.preview}
              name={`${dict.chapterPage.preview} — ${project.title}`}
              tracking={false}
            />
          )}
        </div>

        <h2 className="mt-3 text-xl leading-snug font-semibold">
          <Link
            href={projectPath(locale, project.chapter, project.slug)}
            className="decoration-1 underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline"
          >
            {project.title}
          </Link>
          {project.status === "draft" && (
            <span className="ml-2 rounded-sm border border-chapter-bg px-1.5 py-0.5 align-middle font-mono text-2xs uppercase tracking-label">
              {dict.chapterPage.draft}
            </span>
          )}
        </h2>

        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-2xs">
          {project.device && (
            <>
              <dt className="uppercase tracking-label">{ticket.device}</dt>
              <dd>{project.device}</dd>
            </>
          )}
          {project.role && (
            <>
              <dt className="uppercase tracking-label">{ticket.fix}</dt>
              <dd lang={roleLang}>{project.role}</dd>
            </>
          )}
          {project.duration !== undefined && (
            <>
              <dt className="uppercase tracking-label">{ticket.duration}</dt>
              <dd>
                <time dateTime={durationDateTime(project.duration)}>{formatDuration(project.duration, locale)}</time>
              </dd>
            </>
          )}
          {project.year !== undefined && (
            <>
              <dt className="uppercase tracking-label">{ticket.year}</dt>
              <dd>{project.year}</dd>
            </>
          )}
        </dl>

        {project.summary && <p className="mt-3 text-sm leading-snug">{project.summary}</p>}

        <p
          aria-hidden="true"
          className="mt-3 flex items-center gap-3 border-t border-dashed border-chapter-muted pt-2 font-mono text-2xs uppercase tracking-label"
        >
          <Barcode seed={project.slug} className="h-3 min-w-0 flex-1" />
          <span className="shrink-0">{dict.chapterPage.open} →</span>
        </p>
      </div>
    </article>
  );
}
