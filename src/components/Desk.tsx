import type { ChapterId } from "@/content/chapters";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { site } from "@/site";
import { BootSequence } from "./BootSequence";
import { ChapterMarks } from "./ChapterMarks";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

interface DeskProps {
  locale: Locale;
  dict: Dictionary;
  counts: Record<ChapterId, number>;
}

/**
 * The desk: a table of contents. Name and activity are in the page from the
 * first byte, never behind an interaction; on a first visit only, the boot
 * sequence plays over them for under two seconds.
 */
export function Desk({ locale, dict, counts }: DeskProps) {
  return (
    <div data-view="frame" className="flex min-h-dvh flex-col bg-chapter-bg">
      <BootSequence phrase={dict.boot.phrase} />
      <SkipLink label={dict.skipLink} />
      <TopBar locale={locale} dict={dict} />
      <main
        id="content"
        className="flex flex-1 flex-col justify-between gap-16 px-gutter pt-12 pb-12 md:gap-24 md:pt-20 md:pb-16"
      >
        <div className="max-w-content">
          <h1 className="text-4xl font-semibold leading-tight tracking-display text-chapter-ink">
            {site.ownerName}
          </h1>
          <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">
            {dict.desk.identity}
          </p>
        </div>
        <ChapterMarks locale={locale} dict={dict} counts={counts} />
      </main>
    </div>
  );
}
