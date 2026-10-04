import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { formatDuration } from "@/lib/time";
import { Barcode } from "./Barcode";
import { blurPlaceholder } from "./placeholder";

/** A sunset cut by bars, the chapter's own box art when a project has no cover. */
function Sunset() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="size-full" focusable="false">
      <circle cx="50" cy="66" r="30" className="fill-chapter-accent" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="0" y={62 + i * 6} width="100" height={1 + i * 0.9} className="fill-chapter-bg" />
      ))}
      <rect x="0" y="96" width="100" height="4" className="fill-chapter-bg" />
    </svg>
  );
}

interface VhsJacketProps {
  brand: string;
  /** The chapter's name, as a video label: "Création". */
  label: string;
  title: string;
  /** Language the title is written in, when it is not the page's. */
  lang?: Locale;
  /** The page's language: how the spine reads, how the running time is written. */
  locale: Locale;
  slug: string;
  year?: number;
  /** Running time, in minutes. */
  duration?: number;
  cover?: string;
  /** The page cover's own `sizes`: the browser then fetches one file for both. */
  coverSizes: string;
  /** The cover's blurred preview, shown until the box art loads. */
  coverBlur?: string;
  className?: string;
}

/**
 * The creative chapter's object: each project as a VHS jacket (inspi:
 * folder type › Kurosawa), in the chapter's amber — its spine, then its
 * front: the tape's format, its cover behind scan lines, its title, year
 * and running time. The spine reads upwards in French, downwards in
 * English, as on each language's shelves.
 *
 * It turns to face you once, like a tape pulled from the shelf (globals.css);
 * without animation, it simply faces you. Decorative: everything on it is
 * already on the page, so it is hidden from screen readers.
 */
export function VhsJacket({
  brand,
  label,
  title,
  lang,
  locale,
  slug,
  year,
  duration,
  cover,
  coverSizes,
  coverBlur,
  className = "",
}: VhsJacketProps) {
  const running = duration === undefined ? undefined : formatDuration(duration, locale);
  return (
    <div data-vhs="" aria-hidden="true" className={`relative aspect-[5/9] ${className}`}>
      <div className="vhs-case flex size-full overflow-hidden rounded-sm">
        <div
          data-vhs-spine=""
          className={`flex w-[14%] shrink-0 items-center justify-center overflow-hidden bg-chapter-line py-[8%] text-chapter-accent [writing-mode:vertical-rl] ${locale === "fr" ? "rotate-180" : ""}`}
        >
          <span lang={lang} className="truncate font-mono text-2xs uppercase tracking-label">
            {title}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[4%] bg-chapter-accent p-[7%] text-chapter-bg">
          <div className="flex items-center justify-between font-mono text-2xs leading-none uppercase tracking-label">
            <span className="border border-current px-1 py-0.5 font-semibold">VHS</span>
            <span>PAL</span>
          </div>
          <div className="vhs-art relative min-h-0 flex-1 overflow-hidden bg-chapter-bg">
            {cover ? (
              <Image
                src={cover}
                alt=""
                fill
                sizes={coverSizes}
                loading="eager"
                className="object-cover"
                {...blurPlaceholder(coverBlur)}
              />
            ) : (
              <Sunset />
            )}
          </div>
          <p
            lang={lang}
            className="line-clamp-3 font-ui text-xs leading-tight font-semibold tracking-display uppercase hyphens-auto wrap-break-word md:text-sm lg:text-lg"
          >
            {title}
          </p>
          <div className="flex items-end justify-between gap-2 font-mono text-2xs leading-none uppercase">
            <span data-vhs-meta="">{[year, running].filter((part) => part !== undefined).join(" · ")}</span>
            {/* On a phone's narrow jacket, only what fits on one line. */}
            <Barcode seed={slug} className="hidden h-[1.1em] w-1/3 shrink-0 md:block" />
          </div>
          <span className="font-mono text-2xs leading-none uppercase tracking-label">
            <span className="hidden md:inline">{brand} · </span>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
