// @vitest-environment node
/**
 * The share cards, actually drawn (next/og, the same engine as the build) and
 * read back pixel by pixel: the brief's constraints are checked on the image
 * itself, not on the markup that produced it.
 */
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { chapterIds } from "@/content/chapters";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CARD_SIZE, DeskCard, IconCard, PageCard, SAFE_SQUARE, titleSize, titleWidth } from "@/seo/og/cards";
import { cardFonts } from "@/seo/og/fonts";
import { chapterPalette, framePalette, markColor, type Palette } from "@/seo/tokens";
import { site } from "@/site";

interface Pixels {
  data: Buffer;
  width: number;
  height: number;
}

async function draw(element: ReactElement, size: { width: number; height: number } = CARD_SIZE): Promise<Pixels> {
  const png = Buffer.from(await new ImageResponse(element, { ...size, fonts: cardFonts() }).arrayBuffer());
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function pixel({ data, width }: Pixels, x: number, y: number): [number, number, number] {
  const i = (y * width + x) * 3;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 1);

/** Columns holding anything but the ground. */
function inkedColumns(image: Pixels, ground: string): number[] {
  const bg = rgb(ground);
  const columns: number[] = [];
  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      if (!same(pixel(image, x, y), bg)) {
        columns.push(x);
        break;
      }
    }
  }
  return columns;
}

function expectInsideSafeSquare(image: Pixels, ground: string) {
  const columns = inkedColumns(image, ground);
  expect(columns.length, "nothing was drawn").toBeGreaterThan(0);
  const left = Math.min(...columns);
  const right = Math.max(...columns);
  expect(left, "content left of the centred square").toBeGreaterThanOrEqual(SAFE_SQUARE.left);
  expect(right, "content right of the centred square").toBeLessThan(SAFE_SQUARE.left + SAFE_SQUARE.width);
}

const titles = {
  short: "Alpha",
  usual: "iPhone 16 Pro Max — vitre arrière",
  long: "Une animation de trajets de vol faite maison pour mes propres vidéos de voyage en Malaisie",
  unbreakable: "Anticonstitutionnellementdéraisonnablementinterminable",
};

describe("share cards, drawn", () => {
  it("are 1200×630 — the size every network expects", async () => {
    const image = await draw(<PageCard palette={chapterPalette("dev")} eyebrow="Développement" title="Alpha" />);
    expect([image.width, image.height]).toEqual([1200, 630]);
  });

  it.each(locales)("desk (%s): everything inside the centred square, on the light frame", async (locale) => {
    const frame = framePalette();
    const image = await draw(
      <DeskCard
        palette={frame}
        name={site.ownerName}
        identity={getDictionary(locale).desk.identity}
        marks={chapterIds.map((id) => markColor(id))}
      />,
    );
    expect(pixel(image, 10, 10)).toEqual(rgb(frame.bg));
    expectInsideSafeSquare(image, frame.bg);
  });

  it("desk: shows the four marks, each in its own colour", async () => {
    const image = await draw(
      <DeskCard
        palette={framePalette()}
        name={site.ownerName}
        identity={getDictionary("fr").desk.identity}
        marks={chapterIds.map((id) => markColor(id))}
      />,
    );
    const found = new Set<string>();
    for (let y = 0; y < image.height; y++) {
      for (let x = SAFE_SQUARE.left; x < SAFE_SQUARE.left + SAFE_SQUARE.width; x++) {
        const p = pixel(image, x, y);
        for (const id of chapterIds) if (same(p, rgb(markColor(id)))) found.add(id);
      }
    }
    expect([...found].sort()).toEqual([...chapterIds].sort());
  });

  it.each(chapterIds)("chapter %s: its own ground, its accent dot, all inside the square", async (id) => {
    const palette: Palette = chapterPalette(id);
    const copy = getDictionary("fr").chapters[id];
    const image = await draw(<PageCard palette={palette} eyebrow={site.brand} title={copy.name} subtitle={copy.description} />);
    expect(pixel(image, 10, 10)).toEqual(rgb(palette.bg));
    expectInsideSafeSquare(image, palette.bg);

    let accent = false;
    for (let y = 0; y < 120 && !accent; y++) {
      for (let x = SAFE_SQUARE.left; x < SAFE_SQUARE.left + SAFE_SQUARE.width; x++) {
        if (same(pixel(image, x, y), rgb(palette.accent))) {
          accent = true;
          break;
        }
      }
    }
    expect(accent, "accent dot").toBe(true);
  });

  it.each(locales)("legal notice (%s): the light frame, no colour at all, all inside the square", async (locale) => {
    const palette = framePalette();
    const copy = getDictionary(locale).legal;
    const image = await draw(<PageCard palette={palette} eyebrow={site.brand} title={copy.title} subtitle={copy.description} />);
    expect(pixel(image, 10, 10)).toEqual(rgb(palette.bg));
    expectInsideSafeSquare(image, palette.bg);
    // The frame has no colour of its own: every pixel is a grey, give or take the ground's warmth.
    let chroma = 0;
    for (let y = 0; y < image.height; y += 2) {
      for (let x = 0; x < image.width; x += 2) {
        const [r, g, b] = pixel(image, x, y);
        chroma = Math.max(chroma, Math.max(r, g, b) - Math.min(r, g, b));
      }
    }
    expect(chroma).toBeLessThanOrEqual(8);
  });

  it.each(locales.flatMap((locale) => chapterIds.map((id) => getDictionary(locale).chapters[id].name)))(
    "keeps the word whole: “%s” is drawn at its full measured width",
    async (title) => {
      const palette = chapterPalette("dev");
      const image = await draw(<PageCard palette={palette} eyebrow="ELMZN" title={title} />);
      const columns = inkedColumns(image, palette.bg);
      const drawn = Math.max(...columns) - Math.min(...columns) + 1;
      const measured = titleWidth(title, titleSize(title));
      // Ink excludes the glyphs' side bearings: a few pixels narrower at most.
      // A word broken in two would be drawn far narrower than measured.
      expect(drawn).toBeGreaterThan(measured - 20);
      expect(drawn).toBeLessThanOrEqual(measured + 4);
    },
  );

  it.each(Object.entries(titles))("project with a %s title stays inside the square", async (_, title) => {
    const palette = chapterPalette("creative");
    const image = await draw(<PageCard palette={palette} eyebrow="Création" title={title} />);
    expectInsideSafeSquare(image, palette.bg);
  });

  it("never shows a photo: the whole ground is one flat colour outside the text", async () => {
    const palette = chapterPalette("repair");
    const image = await draw(<PageCard palette={palette} eyebrow="Réparation" title="Montage PC" />);
    for (const [x, y] of [
      [0, 0],
      [1199, 0],
      [0, 629],
      [1199, 629],
      [150, 315],
      [1050, 315],
    ] as const) {
      expect(pixel(image, x, y)).toEqual(rgb(palette.bg));
    }
  });
});

describe("icons, drawn", () => {
  it.each([32, 180, 192, 512])("%ipx: the folder, centred, on the frame", async (size) => {
    const frame = framePalette();
    const image = await draw(<IconCard palette={frame} size={size} />, { width: size, height: size });
    expect([image.width, image.height]).toEqual([size, size]);
    expect(pixel(image, 0, 0)).toEqual(rgb(frame.bg));
    const columns = inkedColumns(image, frame.bg);
    expect(columns.length).toBeGreaterThan(size / 2);
    // Centred: as much margin on the left as on the right, to the pixel.
    expect(Math.abs(Math.min(...columns) - (size - 1 - Math.max(...columns)))).toBeLessThanOrEqual(1);
  });
});
