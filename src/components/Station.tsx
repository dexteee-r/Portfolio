import Image from "next/image";
import Link from "next/link";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { projectPath } from "@/i18n/paths";
import { FolderGlyph } from "./FolderGlyph";
import { StationPreview } from "./StationPreview";

interface StationProps {
  locale: Locale;
  dict: Dictionary;
  project: LocalizedProject;
  index: number;
}

/**
 * One project inside a chapter: a strong image, a title, two or three lines.
 * Enough to make someone want the project page, not enough to replace it.
 * The whole station is one link, carried by the title. With a preview, the
 * image comes alive on demand (StationPreview).
 */
export function Station({ locale, dict, project, index }: StationProps) {
  const flipped = index % 2 === 1;
  const first = index === 0;

  return (
    <article
      lang={project.lang === locale ? undefined : project.lang}
      data-station={project.slug}
      className="group relative grid gap-6 md:grid-cols-12 md:items-center md:gap-10"
    >
      <div
        className={`relative aspect-[16/10] overflow-hidden rounded-sm bg-chapter-surface md:col-span-7 ${
          flipped ? "md:order-2" : ""
        }`}
      >
        {project.cover ? (
          <Image
            src={project.cover}
            alt={project.coverAlt}
            fill
            sizes="(min-width: 768px) 58vw, 100vw"
            className="object-cover"
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : "auto"}
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <FolderGlyph className="w-20 text-chapter-accent" />
            <span className="font-mono text-sm text-chapter-muted">{project.slug}/</span>
          </div>
        )}
        {project.cover && project.preview && (
          <StationPreview
            src={project.preview}
            label={dict.chapterPage.preview}
            name={`${dict.chapterPage.preview} — ${project.title}`}
            tracking={project.chapter === "creative"}
          />
        )}
      </div>

      <div className={`md:col-span-5 ${flipped ? "md:order-1" : ""}`}>
        <p className="flex items-center gap-3 font-mono text-2xs uppercase tracking-label text-chapter-muted">
          <span>{String(index + 1).padStart(2, "0")}</span>
          {project.status === "draft" && (
            <span className="rounded-sm border border-chapter-line px-1.5 py-0.5">{dict.chapterPage.draft}</span>
          )}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-chapter-ink">
          <Link
            href={projectPath(locale, project.chapter, project.slug)}
            className="decoration-1 underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline"
          >
            {project.title}
          </Link>
        </h2>
        {project.summary && <p className="mt-4 max-w-measure text-chapter-muted">{project.summary}</p>}
        <p
          aria-hidden="true"
          className="mt-6 font-mono text-2xs uppercase tracking-label text-chapter-accent-text"
        >
          {dict.chapterPage.open} →
        </p>
      </div>
    </article>
  );
}
