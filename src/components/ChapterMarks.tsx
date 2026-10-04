import { chapterIds, type ChapterId } from "@/content/chapters";
import type { Locale } from "@/i18n/config";
import { formatCount, type Dictionary } from "@/i18n/dictionaries";
import { chapterPath } from "@/i18n/paths";
import { ChapterName } from "./ChapterName";
import { FolderGlyph } from "./FolderGlyph";
import { SiteLink } from "./SiteLink";

/** Written out in full so Tailwind finds every class in the source. */
const MARK_COLOR: Record<ChapterId, string> = {
  dev: "text-mark-dev",
  infra: "text-mark-infra",
  repair: "text-mark-repair",
  creative: "text-mark-creative",
};

/**
 * On a wide desk the folders sit where they were dropped rather than on a
 * toolbar line: each one has its own vertical offset. The tab order stays
 * left to right, the same as the reading order.
 */
const DESK_OFFSET: Record<ChapterId, string> = {
  dev: "md:mt-0",
  infra: "md:mt-10",
  repair: "md:mt-4",
  creative: "md:mt-14",
};

interface ChapterMarksProps {
  locale: Locale;
  dict: Dictionary;
  counts: Record<ChapterId, number>;
  /** Plain anchors, for pages outside the app (the global 404). */
  plain?: boolean;
}

/**
 * The four folders. For a screen reader this is what it really is: a
 * navigation holding a list of links, each naming its chapter and its real
 * number of projects. The folder is the only colour on the frame (rule 1) and
 * it colours a shape, never text.
 */
export function ChapterMarks({ locale, dict, counts, plain = false }: ChapterMarksProps) {
  return (
    <nav aria-label={dict.desk.chaptersLabel}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 md:gap-x-12">
        {chapterIds.map((id) => (
          <li key={id} className={DESK_OFFSET[id]}>
            <SiteLink
              plain={plain}
              href={chapterPath(locale, id)}
              data-chapter-mark={id}
              className="group flex flex-col items-start gap-3 rounded-md p-2 -m-2"
            >
              <FolderGlyph
                className={`${MARK_COLOR[id]} w-16 transition-transform duration-(--duration-fast) ease-standard group-hover:-translate-y-1 md:w-20`}
              />
              <span className="flex flex-col gap-1">
                <span className="text-base font-medium leading-snug text-chapter-ink">
                  <ChapterName name={dict.chapters[id].name} />
                </span>{" "}
                <span className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
                  {formatCount(locale, counts[id], dict.projectCount)}
                </span>
              </span>
            </SiteLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
