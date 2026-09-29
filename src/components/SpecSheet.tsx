import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

interface SpecSheetProps {
  copy: Dictionary["projectPage"]["specs"];
  year?: number;
  role: string;
  /** Language the role is written in, when it is not the page's. */
  roleLang?: Locale;
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
 * text — when, who did what, with what. Real text, in the page's reading
 * order; only the rows that have something to say. Nothing to say: no sheet.
 * A column beside the floppy on a phone, a strip under the title on a wide screen.
 */
export function SpecSheet({ copy, year, role, roleLang, stack, className = "" }: SpecSheetProps) {
  if (year === undefined && !role && stack.length === 0) return null;
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
