/**
 * Motion tracking, the way a video editor's blob tracker does it (inspi:
 * animation › nickjaykdesign): compare each frame's brightness with the one
 * before, keep the grid cells where enough pixels changed, and box each
 * group of neighbouring cells. Pure: frames in, boxes out.
 */

/** Frames are sampled this wide: coarse enough to be cheap, fine enough to follow a body. */
export const SAMPLE_WIDTH = 64;
/** A pixel has moved when its brightness changed by more than this (0–255). */
export const MOTION_THRESHOLD = 24;
/** A cell is hot when at least this share of its pixels moved. */
export const HOT_SHARE = 0.25;
/** Past this many boxes, it is noise: the largest are kept. */
export const MAX_BLOBS = 24;
/**
 * Hot cells this close (in cells) belong to one thing. A body that moves
 * changes at its leading and trailing edges while its middle stays alike:
 * a gap of one still cell must not split it in two.
 */
export const LINK_RADIUS = 2;

export interface MotionCell {
  /** In cells. */
  col: number;
  row: number;
  /** Share of its pixels that moved, 0–1. */
  share: number;
}

export interface Blob {
  /** In fractions of the frame, 0–1, from its top left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Share of the box's pixels that moved, 0–1: the label's percentage. */
  share: number;
}

export interface Motion {
  cols: number;
  rows: number;
  /** Size of a cell, in fractions of the frame. */
  cellWidth: number;
  cellHeight: number;
  cells: MotionCell[];
  blobs: Blob[];
}

/** Brightness of each pixel of an RGBA frame (ITU-R BT.601 weights, integers). */
export function luma(rgba: Uint8ClampedArray, out = new Uint8Array(rgba.length / 4)): Uint8Array {
  for (let i = 0, p = 0; p < out.length; i += 4, p += 1) {
    out[p] = (rgba[i]! * 77 + rgba[i + 1]! * 150 + rgba[i + 2]! * 29) >> 8;
  }
  return out;
}

/**
 * What moved between two frames of `width` × `height` brightness values,
 * on a grid of `cell` × `cell` pixels.
 */
export function trackMotion(previous: Uint8Array, current: Uint8Array, width: number, height: number, cell: number): Motion {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const moved = new Uint32Array(cols * rows);
  const sizes = new Uint32Array(cols * rows);

  for (let y = 0; y < height; y += 1) {
    const rowBase = Math.floor(y / cell) * cols;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const c = rowBase + Math.floor(x / cell);
      sizes[c]! += 1;
      if (Math.abs(current[i]! - previous[i]!) > MOTION_THRESHOLD) moved[c]! += 1;
    }
  }

  const hot = new Uint8Array(cols * rows);
  const cells: MotionCell[] = [];
  for (let c = 0; c < hot.length; c += 1) {
    const share = sizes[c] ? moved[c]! / sizes[c]! : 0;
    if (share >= HOT_SHARE) {
      hot[c] = 1;
      cells.push({ col: c % cols, row: Math.floor(c / cols), share });
    }
  }

  // Hot cells within LINK_RADIUS of each other, diagonals included, make one moving thing.
  const seen = new Uint8Array(cols * rows);
  const blobs: Blob[] = [];
  for (let start = 0; start < hot.length; start += 1) {
    if (!hot[start] || seen[start]) continue;
    let minCol = cols;
    let maxCol = 0;
    let minRow = rows;
    let maxRow = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const c = stack.pop()!;
      const col = c % cols;
      const row = Math.floor(c / cols);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      for (let dy = -LINK_RADIUS; dy <= LINK_RADIUS; dy += 1) {
        for (let dx = -LINK_RADIUS; dx <= LINK_RADIUS; dx += 1) {
          const nc = col + dx;
          const nr = row + dy;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const n = nr * cols + nc;
          if (hot[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    let boxMoved = 0;
    let boxSize = 0;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        boxMoved += moved[row * cols + col]!;
        boxSize += sizes[row * cols + col]!;
      }
    }
    const x0 = (minCol * cell) / width;
    const y0 = (minRow * cell) / height;
    blobs.push({
      x: x0,
      y: y0,
      w: Math.min(1, ((maxCol + 1) * cell) / width) - x0,
      h: Math.min(1, ((maxRow + 1) * cell) / height) - y0,
      share: boxSize ? boxMoved / boxSize : 0,
    });
  }

  blobs.sort((a, b) => b.w * b.h - a.w * a.h);
  return { cols, rows, cellWidth: cell / width, cellHeight: cell / height, cells, blobs: blobs.slice(0, MAX_BLOBS) };
}
