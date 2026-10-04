import { readFileSync } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import sharp from "sharp";
import { ContentError, publicRoot } from "./projects";

export interface Dimensions {
  width: number;
  height: number;
  /** A tiny blurred preview (a data URL), shown in the image's place until it loads. */
  blur?: string;
}

/** Wide enough to keep the image's colours and shapes, small enough to inline: a few hundred bytes. */
const PLACEHOLDER_WIDTH = 16;
const placeholders = new Map<string, Promise<string>>();

/**
 * A blurred stand-in for each image, drawn at build time: the browser shows
 * it at once, in the image's place, while the real one is fetched — and,
 * after a deploy, optimised by the server on its first request. Each file is
 * read once per build, however many pages show it.
 */
export async function readPlaceholders(sources: string[], root: string = publicRoot()): Promise<Record<string, string>> {
  const entries = await Promise.all(
    sources.map(async (src) => {
      const file = path.join(root, src);
      let blur = placeholders.get(file);
      if (!blur) {
        blur = sharp(file)
          .resize({ width: PLACEHOLDER_WIDTH, height: PLACEHOLDER_WIDTH, fit: "inside" })
          .webp({ quality: 50 })
          .toBuffer()
          .then((buffer) => `data:image/webp;base64,${buffer.toString("base64")}`);
        placeholders.set(file, blur);
        // A failure is not remembered: the next build reads the file again.
        blur.catch(() => placeholders.delete(file));
      }
      try {
        return [src, await blur] as const;
      } catch (error) {
        throw new ContentError(`cannot read image ${src}: ${(error as Error).message}`);
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Each image's size and blurred preview: what a page needs to show it without a shift or a blank. */
export async function readImages(sources: string[], root: string = publicRoot()): Promise<Record<string, Dimensions>> {
  const sizes = readDimensions(sources, root);
  const blurs = await readPlaceholders(sources, root);
  return Object.fromEntries(Object.entries(sizes).map(([src, size]) => [src, { ...size, blur: blurs[src] }]));
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
