import { readFileSync } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { ContentError, publicRoot } from "./projects";

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Intrinsic sizes of images in public/, read from the files themselves at
 * build time. Images inside a project text keep their own proportions — a
 * screenshot is not cropped to fit a frame — and never shift the layout
 * while loading.
 */
export function readDimensions(sources: string[], root: string = publicRoot()): Record<string, Dimensions> {
  const sizes: Record<string, Dimensions> = {};
  for (const src of sources) {
    let width: number | undefined;
    let height: number | undefined;
    try {
      ({ width, height } = imageSize(readFileSync(path.join(root, src))));
    } catch (error) {
      throw new ContentError(`cannot read image ${src}: ${(error as Error).message}`);
    }
    if (!width || !height) throw new ContentError(`cannot read the size of image ${src}`);
    sizes[src] = { width, height };
  }
  return sizes;
}
