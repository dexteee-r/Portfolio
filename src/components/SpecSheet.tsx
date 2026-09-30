import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { durationDateTime, formatDuration } from "@/lib/time";

/** The sheet's words: dev's spec sheet, the creative chapter's credits. */
export interface SpecSheetCopy {
  heading: string;
  year: string;
  role: string;
  stack: string;
  /** Only a sheet that names it shows a duration. */
  duration?: string;
}

interface SpecSheetProps {
  copy: SpecSheetCopy;
  locale: Locale;
  year?: number;
  role: string;
  /** Language the role is written in, when it is not the page's. */
  roleLang?: Locale;
  /** Minutes. */
  duration?: number;
  stack: string[];
  className?: string;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="px-3 py-2.5 lg:min-w-0 lg:flex-auto">
      <dt className="uppercase tracking-label text-chapter-muted">{term}</dt>
      <dd className="mt-1 text-xs text-chapter-ink wrap-break-word">{children}</dd>
    </div>
  );
}

/**
 * A project's spec sheet (inspi: DA 2): what a reader skims for before the
 * text — when, who did what, how long, with what. Real text, in the page's
 * reading order; only the rows that have something to say. Nothing to say:
 * no sheet. A column beside the chapter's object on a phone, a strip under
 * the title on a wide screen.
 */
export function SpecSheet({ copy, locale, year, role, roleLang, duration, stack, className = "" }: SpecSheetProps) {
  const timed = copy.duration !== undefined && duration !== undefined;
  if (year === undefined && !role && !timed && stack.length === 0) return null;
  return (
    <section
      aria-labelledby="project-specs"
      data-specs=""
      className={`rounded-sm border border-chapter-line font-mono text-2xs ${className}`}
    >
      <h2
        id="project-specs"
        className="border-b border-chapter-line px-3 py-2 uppercase tracking-label text-chapter-muted"
      >
        {copy.heading}
      </h2>
      <dl className="divide-y divide-chapter-line lg:flex lg:divide-x lg:divide-y-0">
        {year !== undefined && <Row term={copy.year}>{year}</Row>}
        {role && (
          <Row term={copy.role}>
            <span lang={roleLang}>{role}</span>
          </Row>
        )}
        {timed && (
          <Row term={copy.duration!}>
            <time dateTime={durationDateTime(duration!)}>{formatDuration(duration!, locale)}</time>
          </Row>
        )}
        {stack.length > 0 && (
          <Row term={copy.stack}>
            <ul className="flex flex-wrap gap-1.5">
              {stack.map((name) => (
                <li key={name} className="rounded-sm border border-chapter-line px-1.5 py-0.5">
                  {name}
                </li>
              ))}
            </ul>
          </Row>
        )}
      </dl>
    </section>
  );
}
