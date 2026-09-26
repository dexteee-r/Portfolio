import { parse, type Font } from "opentype.js";
import { cardFonts } from "./fonts";
import { CONTENT_WIDTH, TITLE_MAX, TITLE_MAX_LINES, TITLE_MIN, TITLE_TRACKING_EM } from "./layout";

/**
 * Real text measurement for card titles, from the font file itself (glyph
 * advances and kerning). An average character width is not enough: a single
 * long word like "Développement" was sized to "fit" and came out broken in
 * two on the card.
 */

let font: Font | null = null;

function titleFont(): Font {
  if (!font) {
    const entry = cardFonts().find((f) => f.name === "Schibsted Grotesk" && f.weight === 600);
    if (!entry) throw new Error("The semibold title font is missing");
    const { data } = entry;
    font = parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  }
  return font;
}

/** Width in pixels of a title set as the cards set it: semibold, display tracking. */
export function titleWidth(text: string, size: number): number {
  const characters = [...text].length;
  const advance = titleFont().getAdvanceWidth(text, size, { kerning: true });
  return advance + TITLE_TRACKING_EM * size * Math.max(0, characters - 1);
}

/** How many lines a title takes at a size, wrapped at spaces as the card wraps it. */
export function titleLines(text: string, size: number, width: number = CONTENT_WIDTH): number {
  let lines = 1;
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && titleWidth(candidate, size) > width) {
      lines += 1;
      line = word;
    } else {
      line = candidate;
    }
  }
  return lines;
}

/** A few pixels of margin against rounding in the renderer. */
const MARGIN = 8;

/**
 * The largest title size, in steps of 2px, at which every word fits whole on
 * a line and the title holds in three lines. A word too long even at the
 * minimum size is left to break rather than overflow the square.
 */
export function titleSize(title: string): number {
  const text = title.trim();
  const words = text.split(/\s+/);
  const room = CONTENT_WIDTH - MARGIN;
  for (let size = TITLE_MAX; size > TITLE_MIN; size -= 2) {
    const wordsFit = words.every((word) => titleWidth(word, size) <= room);
    if (wordsFit && titleLines(text, size, room) <= TITLE_MAX_LINES) return size;
  }
  return TITLE_MIN;
}
