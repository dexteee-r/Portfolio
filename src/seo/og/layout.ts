/** Geometry of the share cards, shared by the cards and the text measure. */

export const CARD_SIZE = { width: 1200, height: 630 } as const;

/** The centred square that survives a square crop. */
export const SAFE_SQUARE = {
  left: (CARD_SIZE.width - CARD_SIZE.height) / 2,
  width: CARD_SIZE.height,
} as const;

/** Breathing room inside the square. */
export const INSET = 48;
export const CONTENT_WIDTH = SAFE_SQUARE.width - 2 * INSET;

export const TITLE_MAX = 112;
export const TITLE_MIN = 44;
/** Display tracking, as in tokens.css (--tracking-display). */
export const TITLE_TRACKING_EM = -0.035;
export const TITLE_MAX_LINES = 3;
