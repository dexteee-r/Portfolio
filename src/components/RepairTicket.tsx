import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { durationDateTime, formatDuration } from "@/lib/time";
import { Barcode } from "./Barcode";

interface TicketFacts {
  device?: string;
  /** What was done: the project's role, read as the intervention. */
  role: string;
  /** Minutes. */
  duration?: number;
  year?: number;
}

/** A ticket needs at least one fact to print. */
export function hasTicket({ device, role, duration, year }: TicketFacts): boolean {
  return Boolean(device || role || duration !== undefined || year !== undefined);
}

interface RepairTicketProps extends TicketFacts {
  copy: Dictionary["projectPage"]["ticket"];
  locale: Locale;
  brand: string;
  slug: string;
  /** Language the role is written in, when it is not the page's. */
  roleLang?: Locale;
  /** Its place in the chapter: ticket No. 01. */
  number?: number;
  className?: string;
}

function Field({ term, className = "", children }: { term: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <dt className="uppercase tracking-label">{term}</dt>
      <dd className="mt-1 text-xs">{children}</dd>
    </div>
  );
}

/**
 * The repair chapter's object: the intervention as a workshop ticket
 * (inspi: DA 2 › ticket), printed on the chapter's paper — the device in
 * brick, then what was done, how long it took, when. Real text, in reading
 * order; the slot, the tear line and the barcode are decoration.
 *
 * It comes out of its slot in the jerky steps of a thermal printer, once the
 * page has faded in (globals.css); without animation, it simply hangs there.
 */
export function RepairTicket({
  copy,
  locale,
  brand,
  slug,
  device,
  role,
  roleLang,
  duration,
  year,
  number,
  className = "",
}: RepairTicketProps) {
  if (!hasTicket({ device, role, duration, year })) return null;
  return (
    <section
      aria-labelledby="project-ticket"
      data-ticket=""
      className={`font-mono text-2xs text-chapter-bg ${className}`}
    >
      {/* The printer's slot. */}
      <div aria-hidden="true" className="h-1.5 rounded-full bg-chapter-line" />
      <div className="overflow-hidden px-2">
        <div className="ticket-paper">
          <div className="rounded-t-md bg-chapter-ink px-4 pt-4 pb-5">
            <div className="flex items-baseline justify-between gap-3 uppercase tracking-label">
              <h2 id="project-ticket">{copy.heading}</h2>
              {number !== undefined && (
                <span data-ticket-number="" className="shrink-0">
                  {copy.number} {String(number).padStart(2, "0")}
                </span>
              )}
            </div>
            {device && (
              <dl className="mt-4">
                <dt className="uppercase tracking-label">{copy.device}</dt>
                <dd className="mt-1 font-ui text-2xl leading-tight font-semibold tracking-display text-chapter-accent wrap-break-word">
                  {device}
                </dd>
              </dl>
            )}
          </div>

          {/* The tear line, between two notches cut in the paper. */}
          <div aria-hidden="true" className="relative h-4 bg-chapter-ink">
            <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-chapter-bg" />
            <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-chapter-bg" />
            <span className="absolute inset-x-4 top-1/2 border-t-2 border-dotted border-chapter-line" />
          </div>

          <div className="rounded-b-md bg-chapter-ink px-4 pt-3 pb-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {role && (
                <Field term={copy.fix} className="col-span-2">
                  <span lang={roleLang}>{role}</span>
                </Field>
              )}
              {duration !== undefined && (
                <Field term={copy.duration}>
                  <time dateTime={durationDateTime(duration)}>{formatDuration(duration, locale)}</time>
                </Field>
              )}
              {year !== undefined && <Field term={copy.year}>{year}</Field>}
            </dl>
            <div
              aria-hidden="true"
              className="mt-4 flex items-end justify-between gap-4 border-t border-chapter-line pt-3 uppercase tracking-label"
            >
              <span>
                {brand} · {copy.workshop}
              </span>
              <Barcode seed={slug} className="h-5 w-24 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
