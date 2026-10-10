import type { Dimensions } from "@/content/media";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import { formatCount, type Dictionary } from "@/i18n/dictionaries";
import { projectPath } from "@/i18n/paths";
import { ChapterName } from "../ChapterName";
import { BoardReveal } from "./BoardReveal";
import { WorkbenchLightSlot } from "./RepairEffects";
import { ScanReel, type ReelItem } from "./ScanReel";
import { WorkOrder } from "./WorkOrder";

/** The repairs the opening reel shows, in the board's order: every one with a photo. */
export function reelProjects(stations: LocalizedProject[]): LocalizedProject[] {
  return stations.filter((p) => p.cover);
}

/** A repair as the reel shows it, its photo's size read at build time. */
export function toReelItem(project: LocalizedProject, locale: Locale, size: Dimensions): ReelItem {
  return {
    slug: project.slug,
    href: projectPath(locale, project.chapter, project.slug),
    name: project.device ?? project.title,
    cover: project.cover!,
    coverAlt: project.coverAlt,
    lang: project.lang === locale ? undefined : project.lang,
    size,
    markers: project.scan,
    markersLang: project.scanLang === locale ? undefined : project.scanLang,
  };
}

interface RepairWorldProps {
  locale: Locale;
  dict: Dictionary;
  stations: LocalizedProject[];
  publishedCount: number;
  /** The opening's repairs, through the scanner one after another. */
  reel?: ReelItem[] | null;
}

/**
 * The repair chapter's world — « l'établi », the workbench. A pegboard under a
 * workshop lamp that follows the pointer (WebGL, over a CSS pegboard that
 * stands in for it); the opening is a diagnostic reel — every repair's photo
 * through the scanner in turn, an X-ray behind the line, then a lens; below,
 * every intervention as a work order pinned to the board.
 *
 * Complete in the HTML: title, description, the first repair's photo and its
 * named parts, every order and its link. The light, the reel, the X-ray and the
 * pinning are motion, and stay still under reduced motion.
 */
export function RepairWorld({ locale, dict, stations, publishedCount, reel = null }: RepairWorldProps) {
  const copy = dict.chapters.repair;
  const world = dict.repairWorld;
  const opening = reel && reel.length > 0 ? reel : null;

  return (
    <main id="content" data-world="repair" className="flex-1">
      <section className="workbench relative overflow-hidden">
        <WorkbenchLightSlot />
        <div className="relative grid items-center gap-12 px-gutter pt-12 pb-16 md:pt-20 md:pb-20 lg:grid-cols-12 lg:gap-16 lg:pb-24">
          <header className="relative lg:col-span-6">
            <p className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
              {formatCount(locale, publishedCount, dict.projectCount)}
            </p>
            <h1
              data-view-title=""
              tabIndex={-1}
              className="mt-3 text-4xl leading-tight font-semibold tracking-display text-chapter-ink hyphens-auto wrap-break-word"
            >
              <ChapterName name={copy.name} />
            </h1>
            <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">{copy.description}</p>
            {opening && (
              <p aria-hidden="true" className="workbench-stamp">
                {world.stamp}
                <br />
                <b>{world.stampLine}</b>
              </p>
            )}
          </header>

          {opening && (
            <div className="lg:col-span-6 lg:justify-self-end">
              <ScanReel
                items={opening}
                copy={{
                  mode: dict.projectPage.scan.mode,
                  parts: dict.projectPage.scan.parts,
                  seeRepair: world.seeRepair,
                  lensHint: world.lensHint,
                  pause: world.pause,
                  play: world.play,
                }}
              />
            </div>
          )}
        </div>
      </section>

      <section className="workbench-board px-gutter pt-12 pb-16 md:pt-16 md:pb-24">
        {stations.length > 0 ? (
          <BoardReveal label={dict.chapterPage.stationsLabel}>
            {stations.map((project, index) => (
              <li key={project.slug}>
                <WorkOrder locale={locale} dict={dict} project={project} index={index} />
              </li>
            ))}
          </BoardReveal>
        ) : (
          <p className="text-lg text-chapter-ink">{dict.chapterPage.empty}</p>
        )}
      </section>
    </main>
  );
}
