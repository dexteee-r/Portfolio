import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Station } from "@/components/Station";
import { drawTracking, StationPreview, TRACKING_CELLS } from "@/components/StationPreview";
import type { LocalizedProject } from "@/content/projects";
import { getDictionary } from "@/i18n/dictionaries";
import type { Motion } from "@/lib/motion";

const fr = getDictionary("fr");
const SRC = "/media/fixtures/film-preview.webm";

/** matchMedia answering the given queries as true. */
function media(...truthy: string[]) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: truthy.some((t) => query.includes(t)) }),
  });
}

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error — back to jsdom's own: no matchMedia.
  delete window.matchMedia;
});

/** A preview inside its station, as the chapter renders it. */
function renderPreview(tracking = true) {
  const { container } = render(
    <article data-station="film-test">
      <StationPreview src={SRC} label="Aperçu" name="Aperçu — Film test" tracking={tracking} />
    </article>,
  );
  return {
    station: container.querySelector<HTMLElement>("[data-station]")!,
    video: container.querySelector("video")!,
    root: container.querySelector<HTMLElement>("[data-preview]")!,
    button: within(container as HTMLElement).getByRole("button", { name: "Aperçu — Film test" }),
  };
}

describe("StationPreview", () => {
  it("holds a silent, looping clip that loads nothing until asked to play", () => {
    const { video } = renderPreview();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video.loop).toBe(true);
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video.querySelector("source")).toHaveAttribute("type", "video/webm");
  });

  it("names an MP4 as one", () => {
    const { container } = render(<StationPreview src="/media/p/clip.mp4" label="Aperçu" name="Aperçu" tracking={false} />);
    expect(container.querySelector("source")).toHaveAttribute("type", "video/mp4");
  });

  it("plays and pauses with its button — for a finger, a keyboard, anyone", () => {
    const { video, root, button } = renderPreview();
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(play).toHaveBeenCalledTimes(1);

    act(() => void video.dispatchEvent(new Event("play")));
    expect(root).toHaveAttribute("data-playing");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("❚❚ Aperçu");

    Object.defineProperty(video, "paused", { configurable: true, get: () => false });
    fireEvent.click(button);
    expect(pause).toHaveBeenCalled();
    act(() => void video.dispatchEvent(new Event("pause")));
    expect(root).not.toHaveAttribute("data-playing");
    expect(button).toHaveTextContent("▶ Aperçu");
  });

  it("plays on hover with a mouse, and stops when the mouse leaves", () => {
    media("hover: hover");
    const { station } = renderPreview();
    fireEvent.pointerEnter(station);
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(station);
    expect(pause).toHaveBeenCalled();
  });

  it("never plays on its own on a touch screen, nor on hover under reduced motion", () => {
    media(); // a phone: no hover, no fine pointer
    fireEvent.pointerEnter(renderPreview().station);
    media("hover: hover", "reduce");
    fireEvent.pointerEnter(renderPreview().station);
    expect(play).not.toHaveBeenCalled();
  });

  it("tracks motion only when asked: the creative chapter's effect", () => {
    expect(renderPreview(true).root.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(renderPreview(false).root.querySelector("canvas")).toBeNull();
  });

  it("keeps its button above the station's link, so both can be used", () => {
    expect(renderPreview().button).toHaveClass("z-10");
  });
});

describe("drawTracking", () => {
  function recorder(width = 200, height = 100) {
    const calls: Array<[string, ...unknown[]]> = [];
    const context = new Proxy(
      { canvas: { width, height } } as unknown as CanvasRenderingContext2D,
      {
        get(target, key) {
          if (key === "canvas") return (target as unknown as { canvas: unknown }).canvas;
          return (...args: unknown[]) => calls.push([String(key), ...args]);
        },
        set(_, key, value) {
          calls.push([`set ${String(key)}`, value]);
          return true;
        },
      },
    );
    return { context, calls };
  }
  const motion: Motion = {
    cols: 10,
    rows: 5,
    cellWidth: 0.1,
    cellHeight: 0.2,
    cells: [{ col: 2, row: 1, share: 1 }],
    blobs: [{ x: 0.2, y: 0.2, w: 0.3, h: 0.4, share: 0.5 }],
  };
  const colours = { ink: "ink", accent: "accent", font: "mono" };

  it("tints the moving cells in the chapter's colour, then boxes and labels each blob in its ink", () => {
    const { context, calls } = recorder();
    drawTracking(context, [motion, { ...motion, cells: [] }], colours);
    expect(calls[0]).toEqual(["clearRect", 0, 0, 200, 100]);
    expect(calls).toContainEqual(["set fillStyle", "accent"]);
    expect(calls).toContainEqual(["fillRect", 40, 20, 21, 21]);
    expect(calls.filter(([name]) => name === "strokeRect")).toHaveLength(2); // one blob per grid
    expect(calls).toContainEqual(["strokeRect", 40.5, 20.5, 60, 40]);
    expect(calls).toContainEqual(["fillText", "50%", 42.5, 22.5]);
    expect(calls).toContainEqual(["set strokeStyle", "ink"]);
  });

  it("draws nothing but a clean frame without motion", () => {
    const { context, calls } = recorder();
    drawTracking(context, [], colours);
    expect(calls).toEqual([["clearRect", 0, 0, 200, 100]]);
  });

  it("looks at two scales, fine within coarse", () => {
    expect([...TRACKING_CELLS]).toEqual([4, 8]);
  });
});

describe("Station — its preview", () => {
  function project(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
    return {
      slug: "film-test",
      chapter: "creative",
      status: "published",
      title: "Film test",
      summary: "Un film.",
      lang: "fr",
      body: "",
      bodyLang: "fr",
      cover: "/media/fixtures/film-cover.webp",
      coverAlt: "Dégradé ambre.",
      preview: SRC,
      links: [],
      stack: [],
      role: "",
      roleLang: "fr",
      scan: [],
      scanLang: "fr",
      ...overrides,
    };
  }

  it("brings the image to life, with a tracked clip in the creative chapter", () => {
    const { container } = render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    expect(container.querySelector("[data-preview] video")).not.toBeNull();
    expect(container.querySelector("[data-preview] canvas")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Aperçu — Film test" })).toBeInTheDocument();
  });

  it("plays a plain clip elsewhere: tracking is the creative chapter's alone", () => {
    const { container } = render(<Station locale="fr" dict={fr} project={project({ chapter: "dev" })} index={0} />);
    expect(container.querySelector("[data-preview] video")).not.toBeNull();
    expect(container.querySelector("[data-preview] canvas")).toBeNull();
  });

  it("has no preview without a clip", () => {
    const { container } = render(<Station locale="fr" dict={fr} project={project({ preview: undefined })} index={0} />);
    expect(container.querySelector("[data-preview]")).toBeNull();
  });
});
