import type { Locale } from "@/i18n/config";

/** Bars and gaps of the label's code, in units: 14 of each. */
const BARCODE_LENGTH = 28;

/**
 * Widths of the label's barcode, alternately bar and gap, drawn from a seed:
 * the same project always prints the same code. Decorative — it encodes nothing.
 */
export function barcode(seed: string): number[] {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const widths: number[] = [];
  for (let i = 0; i < BARCODE_LENGTH; i += 1) {
    hash = Math.imul(hash ^ i, 16777619) >>> 0;
    // Bars 1 to 3 units wide, gaps 1 or 2: it reads as a code, never as a block.
    widths.push(i % 2 === 0 ? 1 + (hash % 3) : 1 + (hash % 2));
  }
  return widths;
}

/** The bars laid end to end, gaps between them, and the code's total width. */
function layBars(widths: number[]): { bars: Array<{ x: number; width: number }>; length: number } {
  const bars: Array<{ x: number; width: number }> = [];
  let x = 0;
  widths.forEach((width, index) => {
    if (index % 2 === 0) bars.push({ x, width });
    x += width;
  });
  return { bars, length: x };
}

function Barcode({ seed, className }: { seed: string; className?: string }) {
  const { bars, length } = layBars(barcode(seed));
  return (
    <svg viewBox={`0 0 ${length} 10`} preserveAspectRatio="none" className={className} focusable="false">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="10" />
      ))}
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

interface FloppyProps {
  brand: string;
  title: string;
  /** Language the title is written in, when it is not the page's. */
  lang?: Locale;
  slug: string;
  year?: number;
  /** Its place in the chapter: disk 1 of 4. */
  disk?: { number: number; total: number };
  className?: string;
}

/**
 * The dev chapter's object: each project as a labelled 3.5" floppy disk
 * (inspi: folder type › floppy disk mockups), in the chapter's indigo, its
 * label on the chapter's paper. Its shutter slides open once, as the disk is
 * read (globals.css); it rests open, so without animation it is simply open.
 *
 * Decorative: everything on the label is already on the page, so the whole
 * disk is hidden from screen readers.
 */
export function Floppy({ brand, title, lang, slug, year, disk, className = "" }: FloppyProps) {
  return (
    <div data-floppy="" aria-hidden="true" className={`relative aspect-square ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" focusable="false">
        <defs>
          <clipPath id="floppy-opening">
            <rect x="45" y="4" width="12" height="24" rx="1" />
          </clipPath>
          {/* The shutter's own window, cut through it: it moves with the shutter. */}
          <mask id="floppy-shutter-window">
            <rect x="26" y="0" width="42" height="31" fill="white" />
            <rect x="31" y="4" width="12" height="24" rx="1" fill="black" />
          </mask>
        </defs>

        {/* The case, its top right corner cut. */}
        <path d="M2 0H94L100 6V98Q100 100 98 100H2Q0 100 0 98V2Q0 0 2 0Z" className="fill-chapter-accent" />
        {/* The insertion arrow, moulded in. */}
        <path d="M8 13L11 8L14 13Z" className="fill-chapter-bg" opacity="0.35" />

        {/* The opening in the case, and the disk seen through it: its rim, one track. */}
        <rect x="45" y="4" width="12" height="24" rx="1" className="fill-chapter-bg" />
        <g clipPath="url(#floppy-opening)">
          <circle cx="51" cy="54" r="44" className="fill-chapter-surface" />
          <circle cx="51" cy="54" r="36" fill="none" strokeWidth="0.4" className="stroke-chapter-line" />
        </g>

        {/* Closed, its window sits over plastic; open, over the opening. */}
        <g className="floppy-shutter">
          <rect x="26" y="0" width="42" height="31" mask="url(#floppy-shutter-window)" className="fill-chapter-muted" />
        </g>

        {/* Write-protect and density holes. */}
        <rect x="3" y="89" width="5" height="6" rx="0.5" className="fill-chapter-bg" />
        <rect x="92" y="89" width="5" height="6" rx="0.5" className="fill-chapter-bg" />

        <rect x="10" y="38" width="80" height="58" rx="1.5" className="fill-chapter-ink" />
      </svg>

      <div className="absolute top-[38%] left-[10%] flex h-[58%] w-[80%] flex-col justify-between px-[6%] py-[5%] text-chapter-bg">
        <div className="flex flex-col gap-[0.35em] font-mono text-2xs leading-none uppercase tracking-label">
          <div className="flex items-baseline justify-between gap-2">
            <span>{brand}</span>
            {disk && (
              <span data-floppy-disk="">
                {pad(disk.number)}/{pad(disk.total)}
              </span>
            )}
          </div>
          <span className="block h-0.5 bg-chapter-accent lg:h-1" />
        </div>
        <p
          lang={lang}
          className="line-clamp-2 text-xs leading-tight font-semibold tracking-display hyphens-auto wrap-break-word md:text-sm lg:text-xl"
        >
          {title}
        </p>
        <div className="flex items-end justify-between gap-2 font-mono text-2xs leading-none">
          <span>{year}</span>
          <Barcode seed={slug} className="h-[1.1em] w-1/2 fill-current" />
        </div>
      </div>
    </div>
  );
}
