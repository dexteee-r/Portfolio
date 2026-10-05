import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeskArt, { PIXELS } from "@/components/desk-art/DeskArt";
import { DESK_ART_MEDIA, DeskArtSlot } from "@/components/desk-art/DeskArtSlot";

vi.mock("next/dynamic", () => ({
  // Loaded synchronously here: what matters is when the slot mounts it.
  default: () =>
    function Loaded() {
      return <div data-loaded="" />;
    },
}));

/** A matchMedia whose answer for the desk art's query can change. */
function media(initially: boolean) {
  const listeners = new Set<() => void>();
  const state = { matches: initially };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === DESK_ART_MEDIA ? state.matches : false;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return (next: boolean) => {
    state.matches = next;
    act(() => listeners.forEach((listener) => listener()));
  };
}

afterEach(() => {
  // @ts-expect-error — back to jsdom's own: no matchMedia.
  delete window.matchMedia;
});

describe("DeskArtSlot", () => {
  it("keeps its place on wide screens with a fine pointer, and none on a phone", () => {
    media(false);
    const { container } = render(<DeskArtSlot />);
    const slot = container.querySelector("[data-desk-art-slot]")!;
    expect(slot).toHaveClass("hidden", "lg:pointer-fine:block");
  });

  it("loads the koi only where they show — never on a phone", () => {
    const change = media(false);
    const { container } = render(<DeskArtSlot />);
    expect(container.querySelector("[data-loaded]")).toBeNull();
    change(true);
    expect(container.querySelector("[data-loaded]")).not.toBeNull();
    change(false);
    expect(container.querySelector("[data-loaded]")).toBeNull();
  });

  it("follows the older media API too (Safari before 14), and a browser with none", () => {
    const listeners = new Set<() => void>();
    const state = { matches: false };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        get matches() {
          return state.matches;
        },
        addListener: (listener: () => void) => listeners.add(listener),
        removeListener: (listener: () => void) => listeners.delete(listener),
      }),
    });
    const { container, unmount } = render(<DeskArtSlot />);
    state.matches = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(container.querySelector("[data-loaded]")).not.toBeNull();
    unmount();
    expect(listeners.size).toBe(0);

    // @ts-expect-error — a browser without matchMedia at all.
    delete window.matchMedia;
    expect(() => render(<DeskArtSlot />)).not.toThrow();
  });

  it("asks for a wide screen with a fine pointer, at the same width as lg:", () => {
    expect(DESK_ART_MEDIA).toBe("(min-width: 64rem) and (pointer: fine)");
  });
});

describe("DeskArt", () => {
  it("is decorative, hidden from screen readers", () => {
    const { container } = render(<DeskArt />);
    const art = container.querySelector("[data-desk-art]")!;
    expect(art).toHaveAttribute("data-desk-art", "koi");
    expect(art).toHaveAttribute("aria-hidden", "true");
  });

  it("swims frame by frame — but leaves the boot sequence the whole main thread", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const put = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: put } as never);
    const tick = (at: number) => act(() => frames.shift()!(at));

    document.documentElement.setAttribute("data-boot", "play");
    render(<DeskArt />);
    expect(put).toHaveBeenCalledTimes(1); // the first, still frame
    tick(performance.now() + 1000);
    expect(put).toHaveBeenCalledTimes(1); // the sequence plays: no frame drawn

    document.documentElement.removeAttribute("data-boot");
    tick(performance.now() + 2000);
    expect(put).toHaveBeenCalledTimes(2); // the desk is shown: the koi swim

    getContext.mockRestore();
    vi.unstubAllGlobals();
  });

  it("is drawn on a small canvas in the frame's ink, scaled up without blur", () => {
    const { container } = render(<DeskArt />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(PIXELS);
    expect(canvas.height).toBe(PIXELS);
    expect(canvas).toHaveClass("[image-rendering:pixelated]", "text-chapter-ink");
  });
});
