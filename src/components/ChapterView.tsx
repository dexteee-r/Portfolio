import Link from "next/link";
import { chapterSlugs, type ChapterId } from "@/content/chapters";
import type { NetworkNode } from "@/content/network-layout";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import { formatCount, type Dictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { ChapterName } from "./ChapterName";
import { DrawerIndex } from "./DrawerIndex";
import { NetworkMap } from "./NetworkMap";
import { RepairWorld } from "./repair/RepairWorld";
import type { ReelItem } from "./repair/ScanReel";
import { SiteFooter } from "./SiteFooter";
import { SkipLink } from "./SkipLink";
import { Station } from "./Station";
import { TopBar } from "./TopBar";

interface ChapterViewProps {
  locale: Locale;
  dict: Dictionary;
  chapter: ChapterId;
  stations: LocalizedProject[];
  /** Published projects only — the same number the desk shows. */
  publishedCount: number;
  /** The homelab, drawn under the infra chapter's title (its one effect). */
  network?: NetworkNode[] | null;
  /** The repair world's opening reel: its repairs through the scanner. */
  reel?: ReelItem[] | null;
}

/**
 * A chapter: its own grade (data-chapter), and — chapter by chapter, since
 * 2026-10-10 — its own world: the repair chapter is a workbench
 * (repair/RepairWorld); the others still share the stroll below, one station
 * per project. Works on its own when reached from an outside link.
 */
export function ChapterView({
  locale,
  dict,
  chapter,
  stations,
  publishedCount,
  network = null,
  reel = null,
}: ChapterViewProps) {
  const copy = dict.chapters[chapter];

  const stroll = (
    <main id="content" className="flex-1 px-gutter pt-12 pb-16 md:pt-20 md:pb-24">
      <header className="max-w-content">
        <p className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
          {formatCount(locale, publishedCount, dict.projectCount)}
        </p>
        <h1
          data-view-title=""
          tabIndex={-1}
          className="mt-3 text-3xl font-semibold leading-tight tracking-display text-chapter-accent hyphens-auto wrap-break-word md:text-4xl"
        >
          <ChapterName name={copy.name} />
        </h1>
        <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">{copy.description}</p>
      </header>

      {chapter === "infra" && network && <NetworkMap dict={dict} nodes={network} />}

      <DrawerIndex locale={locale} dict={dict} projects={stations} />

      {stations.length > 0 ? (
        <ol aria-label={dict.chapterPage.stationsLabel} className="mt-16 flex flex-col gap-20 md:mt-24 md:gap-32">
          {stations.map((project, index) => (
            <li key={project.slug}>
              <Station locale={locale} dict={dict} project={project} index={index} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-16 text-lg text-chapter-ink md:mt-24">{dict.chapterPage.empty}</p>
      )}
    </main>
  );

  return (
    <div
      data-view="chapter"
      data-chapter={chapter}
      className="flex min-h-dvh flex-col bg-chapter-bg text-chapter-ink"
    >
      <SkipLink label={dict.skipLink} />
      <TopBar locale={locale} dict={dict} trail={[{ label: chapterSlugs[chapter][locale] }]} />

      {chapter === "repair" ? (
        <RepairWorld locale={locale} dict={dict} stations={stations} publishedCount={publishedCount} reel={reel} />
      ) : (
        stroll
      )}

      <SiteFooter
        locale={locale}
        dict={dict}
        back={
          <>
            <Link href={homePath(locale)} className="text-chapter-ink hover:underline">
              <span aria-hidden="true">← </span>
              {dict.chapterPage.backToDesk}
            </Link>
            <span aria-hidden="true" className="hidden pointer-fine:inline">
              {" · "}
              <kbd className="font-mono">{dict.chapterPage.escapeHint}</kbd>
            </span>
            {/* The touch counterpart of Escape: the drawer, by hand. On its own
                line: beside the link, it would turn the link into a link in a
                sentence, told apart by colour alone. */}
            <span data-pull-hint="" aria-hidden="true" className="mt-2 hidden pointer-coarse:block">
              {dict.chapterPage.pullHint}
            </span>
          </>
        }
      />
    </div>
  );
}
