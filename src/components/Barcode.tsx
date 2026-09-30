/** Bars and gaps of a code, in units: 14 of each. */
const BARCODE_LENGTH = 28;

/**
 * Widths of a barcode, alternately bar and gap, drawn from a seed: the same
 * project always prints the same code. Decorative — it encodes nothing.
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

/** A project's barcode, stretched to its box, in the current text colour. Hidden from screen readers. */
export function Barcode({ seed, className }: { seed: string; className?: string }) {
  const { bars, length } = layBars(barcode(seed));
  return (
    <svg
      viewBox={`0 0 ${length} 10`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`fill-current ${className ?? ""}`}
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="10" />
      ))}
    </svg>
  );
}
