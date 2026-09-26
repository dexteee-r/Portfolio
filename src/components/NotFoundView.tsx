import type { ChapterId } from "@/content/chapters";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { ChapterMarks } from "./ChapterMarks";
import { SiteLink } from "./SiteLink";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";

interface NotFoundViewProps {
  locale: Locale;
  dict: Dictionary;
  counts: Record<ChapterId, number>;
}

/**
 * Part of the universe, not a framework default: the requested folder does not
 * exist, and the four that do are right there so the visitor leaves somewhere
 * instead of closing the tab.
 *
 * It is the global 404, a document outside the app's root layout: every way
 * out is a full page load, so its links are plain anchors — nothing to
 * prefetch, and no request for the missing page in the other language.
 */
export function NotFoundView({ locale, dict, counts }: NotFoundViewProps) {
  return (
    <div data-view="frame" className="flex min-h-dvh flex-col bg-chapter-bg">
      <SkipLink label={dict.skipLink} />
      <TopBar locale={locale} dict={dict} plain />
      <main
        id="content"
        className="flex flex-1 flex-col justify-between gap-16 px-gutter pt-12 pb-12 md:gap-24 md:pt-20 md:pb-16"
      >
        <div className="max-w-content">
          <p className="font-mono text-2xs uppercase tracking-label text-chapter-muted">404</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-display text-chapter-ink">
            {dict.notFound.title}
          </h1>
          <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">
            {dict.notFound.body}
          </p>
          <p className="mt-8">
            <SiteLink
              plain
              href={homePath(locale)}
              className="text-sm font-medium text-chapter-ink underline decoration-1 underline-offset-4"
            >
              {dict.notFound.back}
            </SiteLink>
          </p>
        </div>
        <ChapterMarks locale={locale} dict={dict} counts={counts} plain />
      </main>
    </div>
  );
}
