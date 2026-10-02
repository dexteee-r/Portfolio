import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BootSequence } from "@/components/BootSequence";
import { Desk } from "@/components/Desk";
import { FOLDER_BACK, FOLDER_FRONT } from "@/components/FolderGlyph";
import { chapterIds } from "@/content/chapters";
import { getDictionary } from "@/i18n/dictionaries";
import {
  BOOT_ATTRIBUTE,
  BOOT_FAILSAFE,
  BOOT_HOLD_ANIMATION,
  BOOT_NAMES,
  BOOT_STORAGE_KEY,
  BOOT_TOTAL,
  bootConfig,
  bootRuntime,
  bootScript,
  bootTimeline,
  DESK_PATH,
  nameWindows,
} from "@/lib/boot";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr" }));

const ROOT = join(__dirname, "..", "..");
const tokens = readFileSync(join(ROOT, "src", "styles", "tokens.css"), "utf8");
const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim();

describe("the timeline", () => {
  const { trace, phrase, split, fly, ground } = bootTimeline;
  const traceEnd = trace.at + trace.duration;
  const windows = nameWindows();

  it("is paced to be read, yet stays short: under four seconds", () => {
    expect(BOOT_TOTAL).toBe(3950);
    expect(BOOT_TOTAL).toBeLessThan(4000);
  });

  it("traces the folder from the first paint", () => {
    expect(trace.at).toBe(0);
    expect(trace.duration).toBeGreaterThanOrEqual(700);
  });

  it("cycles through four real project names, in order", () => {
    expect(BOOT_NAMES).toEqual(["mytcg", "schooltrack", "watchlist", "dexteeer-labo"]);
    expect(windows.map((w) => w.name)).toEqual([...BOOT_NAMES]);
  });

  it("starts the names while the folder is still tracing", () => {
    expect(windows[0]!.at).toBeLessThan(traceEnd);
  });

  it("leaves each name on long enough to read it", () => {
    for (const w of windows) expect(w.until - w.at).toBeGreaterThanOrEqual(300);
  });

  it("shows exactly one name at a time, back to back", () => {
    for (let i = 1; i < windows.length; i++) expect(windows[i]!.at).toBe(windows[i - 1]!.until);
  });

  it("brings the sentence after the folder and the names, and holds it", () => {
    expect(phrase.at).toBeGreaterThanOrEqual(traceEnd);
    expect(phrase.at).toBeGreaterThan(windows.at(-1)!.at);
    expect(split.at - (phrase.at + phrase.duration)).toBeGreaterThanOrEqual(600);
  });

  it("keeps the last name on the folder until it splits", () => {
    expect(windows.at(-1)!.until).toBe(split.at);
  });

  it("ends on the folders landing: they fly as the centre fades, over a clearing ground", () => {
    expect(fly.at).toBeGreaterThanOrEqual(split.at);
    expect(fly.at).toBeLessThan(split.at + split.duration);
    expect(ground.at).toBeGreaterThan(fly.at);
    expect(ground.at + ground.duration).toBeLessThanOrEqual(BOOT_TOTAL);
    expect(BOOT_TOTAL).toBe(fly.at + (chapterIds.length - 1) * fly.stagger + fly.duration);
  });

  it("gives up waiting well after the end, never before", () => {
    expect(BOOT_FAILSAFE).toBeGreaterThan(BOOT_TOTAL + 1000);
  });

  it("uses the easing curves of tokens.css", () => {
    expect(bootConfig().easeExit).toBe(token("--ease-exit"));
    expect(bootConfig().easeFlight).toBe(token("--ease-standard"));
  });

  it("lifts the folders off gently enough to follow: no instant burst", () => {
    // The first control point of the curve sits on the time axis: zero velocity at take-off.
    const [, y1] = /cubic-bezier\(([\d.]+),\s*([\d.]+)/.exec(bootConfig().easeFlight)!.slice(1).map(Number);
    expect(y1).toBe(0);
  });

  it("says the brief's sentence, word for word", () => {
    expect(getDictionary("fr").boot.phrase).toBe("Tout commence par un dossier vide.");
  });
});

describe("DESK_PATH", () => {
  it.each(["/fr", "/en", "/fr/"])("matches the desk %s", (path) => expect(DESK_PATH.test(path)).toBe(true));
  it.each(["/", "/fr/dev", "/fr/dev/mytgc", "/nl", "/french", "/fr/x"])("ignores %s", (path) =>
    expect(DESK_PATH.test(path)).toBe(false),
  );
});

/* ---------------------------------------------------------------------------
   The runtime, exercised in jsdom. Web Animations and layout are stubbed.
   --------------------------------------------------------------------------- */

interface Played {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
  resolve: () => void;
}

const root = document.documentElement;
let reduced = false;
let played: Played[] = [];
let autoFinish = true;
const originalAnimate = Element.prototype.animate;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect;
}

beforeEach(() => {
  reduced = false;
  played = [];
  autoFinish = true;
  localStorage.clear();
  root.removeAttribute(BOOT_ATTRIBUTE);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: query.includes("reduce") && reduced, media: query }),
  });
  Element.prototype.animate = function (this: Element, keyframes, options) {
    let resolve!: () => void;
    const finished = new Promise<Animation>((r) => {
      resolve = () => r(animation);
    });
    const cancel = vi.fn();
    const animation = { finished, cancel } as unknown as Animation;
    played.push({ el: this, keyframes: keyframes as Keyframe[], options: options as KeyframeAnimationOptions, cancel, resolve });
    if (autoFinish) resolve();
    return animation;
  };
});

afterEach(() => {
  window.dispatchEvent(new KeyboardEvent("keydown")); // end anything still running
  root.removeAttribute(BOOT_ATTRIBUTE);
  Element.prototype.animate = originalAnimate;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function run(path: string) {
  window.history.replaceState({}, "", path);
  bootRuntime(bootConfig());
}

function animationEnd(name: string) {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  document.body.dispatchEvent(event);
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("deciding whether to play", () => {
  it("plays on a first load of the desk, and remembers it at once", () => {
    run("/fr");
    expect(root.getAttribute(BOOT_ATTRIBUTE)).toBe("play");
    expect(localStorage.getItem(BOOT_STORAGE_KEY)).toBe("seen");
  });

  it("runs the same from the inline script as from the module", () => {
    window.history.replaceState({}, "", "/en");
    new Function(bootScript())();
    expect(root.getAttribute(BOOT_ATTRIBUTE)).toBe("play");
  });

  it("never plays twice", () => {
    run("/fr");
    window.dispatchEvent(new KeyboardEvent("keydown"));
    run("/fr");
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });

  it("does not play — nor count as seen — when the first page is not the desk", () => {
    run("/fr/dev");
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(BOOT_STORAGE_KEY)).toBeNull();
  });

  it("does not play under prefers-reduced-motion", () => {
    reduced = true;
    run("/fr");
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(BOOT_STORAGE_KEY)).toBeNull();
  });

  it("stays silent when storage is unavailable, rather than replay on every visit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    run("/fr");
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });
});

describe("skipping and giving up", () => {
  it.each([
    ["a key", () => new KeyboardEvent("keydown", { key: "Tab" })],
    ["a click", () => new Event("pointerdown")],
    ["a scroll", () => new Event("wheel")],
    ["a touch", () => new Event("touchstart")],
  ])("is skipped by %s", (_, event) => {
    run("/fr");
    window.dispatchEvent(event());
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });

  it("does not stop the skipping key from doing its job", () => {
    run("/fr");
    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it("goes anyway if the animations never run (a tab opened in the background)", () => {
    vi.useFakeTimers();
    run("/fr");
    vi.advanceTimersByTime(BOOT_FAILSAFE - 1);
    expect(root.getAttribute(BOOT_ATTRIBUTE)).toBe("play");
    vi.advanceTimersByTime(1);
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });

  it("cleans up after itself: nothing reacts once it is over", () => {
    run("/fr");
    window.dispatchEvent(new KeyboardEvent("keydown"));
    root.setAttribute(BOOT_ATTRIBUTE, "sentinel");
    window.dispatchEvent(new KeyboardEvent("keydown"));
    animationEnd(BOOT_HOLD_ANIMATION);
    expect(root.getAttribute(BOOT_ATTRIBUTE)).toBe("sentinel");
    expect(played).toHaveLength(0);
  });
});

describe("the finale", () => {
  const SOURCE = rect(660, 360, 80, 62.5); // the grey folder, centred
  const TARGETS: Record<string, DOMRect> = {
    dev: rect(48, 666, 80, 62.5),
    infra: rect(396, 706, 80, 62.5),
    repair: rect(744, 682, 64, 50),
    creative: rect(1092, 722, 64, 50),
  };

  function renderDesk() {
    render(<Desk locale="fr" dict={getDictionary("fr")} counts={{ dev: 2, infra: 1, repair: 0, creative: 1 }} />);
    document.querySelector<SVGElement>(".boot-folder")!.getBoundingClientRect = () => SOURCE;
    for (const id of chapterIds) {
      document.querySelector<SVGElement>(`[data-chapter-mark="${id}"] svg`)!.getBoundingClientRect = () => TARGETS[id]!;
    }
  }

  const flightOf = (id: string) =>
    played.find((p) => p.el.getAttribute("data-boot-fly") === id && String(p.keyframes[1]?.transform ?? "").includes("translate"));

  it("waits for the sentence: nothing flies before the hold ends", () => {
    renderDesk();
    run("/fr");
    animationEnd("boot-trace");
    animationEnd("boot-in");
    expect(played).toHaveLength(0);
  });

  it("fades the grey folder, its label and the sentence, then clears the ground", () => {
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    const config = bootConfig();

    const center = played.find((p) => p.el.classList.contains("boot-center"))!;
    expect(center.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(center.options.duration).toBe(config.centerFade);

    const ground = played.find((p) => p.el.classList.contains("boot-ground"))!;
    expect(ground.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(ground.options.delay).toBe(config.groundDelay);
    expect(ground.options.duration).toBe(config.groundDuration);
  });

  it("starts every coloured folder exactly on the grey one", () => {
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    for (const id of chapterIds) {
      const flyer = document.querySelector<HTMLElement>(`[data-boot-fly="${id}"]`)!;
      expect(flyer.style.left).toBe(`${SOURCE.left}px`);
      expect(flyer.style.top).toBe(`${SOURCE.top}px`);
      expect(flyer.style.width).toBe(`${SOURCE.width}px`);
    }
  });

  it("lands each one exactly on its own mark, centre on centre, at the mark's size", () => {
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);

    for (const id of chapterIds) {
      const flight = flightOf(id)!;
      const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(String(flight.keyframes[1]!.transform))!;
      const [dx, dy, scale] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const target = TARGETS[id]!;
      // Where the flyer's centre ends up, and how wide it is there:
      expect(SOURCE.left + SOURCE.width / 2 + dx).toBeCloseTo(target.left + target.width / 2, 6);
      expect(SOURCE.top + SOURCE.height / 2 + dy).toBeCloseTo(target.top + target.height / 2, 6);
      expect(SOURCE.width * scale).toBeCloseTo(target.width, 6);
    }
  });

  it("sends them one after the other, in desk order, on the standard curve", () => {
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    const config = bootConfig();
    chapterIds.forEach((id, index) => {
      const flight = flightOf(id)!;
      expect(flight.options.delay).toBe(config.flyDelay + index * config.flyStagger);
      expect(flight.options.duration).toBe(config.flyDuration);
      expect(flight.options.easing).toBe(token("--ease-standard"));
    });
  });

  it("animates opacity and transform only", () => {
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    for (const p of played) {
      for (const frame of p.keyframes) {
        for (const property of Object.keys(frame)) expect(["opacity", "transform"]).toContain(property);
      }
    }
  });

  it("hands the desk over once the last folder has landed", async () => {
    autoFinish = false;
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);

    for (const id of chapterIds.slice(0, -1)) flightOf(id)!.resolve();
    await settle();
    expect(root.getAttribute(BOOT_ATTRIBUTE)).toBe("play");

    flightOf(chapterIds.at(-1)!)!.resolve();
    await settle();
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });

  it("stops everything mid-flight when skipped", () => {
    autoFinish = false;
    renderDesk();
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    window.dispatchEvent(new Event("pointerdown"));
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
    for (const p of played) expect(p.cancel).toHaveBeenCalled();
  });

  it("falls back to a plain fade when there is no mark to land on", async () => {
    render(<BootSequence phrase="x" />);
    document.querySelector<SVGElement>(".boot-folder")!.getBoundingClientRect = () => SOURCE;
    run("/fr");
    animationEnd(BOOT_HOLD_ANIMATION);
    const fade = played.find((p) => p.el.hasAttribute("data-boot-overlay"))!;
    expect(fade.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    await settle();
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });

  it("hands the desk straight over where Web Animations are missing", () => {
    renderDesk();
    run("/fr");
    // Only now, so the overlay found by the finale has no animate() either.
    Element.prototype.animate = undefined as unknown as typeof Element.prototype.animate;
    animationEnd(BOOT_HOLD_ANIMATION);
    expect(root.hasAttribute(BOOT_ATTRIBUTE)).toBe(false);
  });
});

describe("BootSequence", () => {
  it("is decorative: hidden from assistive technology", () => {
    const { container } = render(<BootSequence phrase="Tout commence par un dossier vide." />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("traces the same folder as the chapter marks", () => {
    const { container } = render(<BootSequence phrase="x" />);
    const paths = [...container.querySelectorAll(".boot-folder path")];
    expect(paths.map((p) => p.getAttribute("d"))).toEqual([FOLDER_BACK, FOLDER_FRONT]);
    for (const path of paths) expect(path).toHaveAttribute("pathLength", "1");
  });

  it("puts every name on the label with its own window, from the timeline", () => {
    const { container } = render(<BootSequence phrase="x" />);
    const names = [...container.querySelectorAll<HTMLElement>(".boot-name")];
    expect(names.map((n) => n.textContent)).toEqual([...BOOT_NAMES]);
    names.forEach((name, i) => {
      const w = nameWindows()[i]!;
      expect(name.style.getPropertyValue("--boot-at")).toBe(`${w.at}ms`);
      expect(name.style.getPropertyValue("--boot-for")).toBe(`${w.until - w.at}ms`);
    });
  });

  it("lets the runtime place the folders before React hydrates, without a mismatch", async () => {
    // A slow device: the finale has already run when React arrives.
    const container = document.createElement("div");
    container.innerHTML = renderToString(<BootSequence phrase="x" />);
    document.body.appendChild(container);
    for (const flyer of container.querySelectorAll<HTMLElement>("[data-boot-fly]")) {
      // What the runtime writes (lib/boot.ts, finale).
      flyer.style.left = "-20px";
      flyer.style.top = "-134.25px";
      flyer.style.width = "80px";
    }
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <BootSequence phrase="x" />);
    });
    const mismatches = errors.mock.calls.filter((call) => /hydrat/i.test(call.map(String).join(" ")));
    errors.mockRestore();
    expect(mismatches).toEqual([]);
    // And React leaves the runtime's placement alone.
    expect(container.querySelector<HTMLElement>("[data-boot-fly]")!.style.width).toBe("80px");
    container.remove();
  });

  it("holds the four coloured folders, in desk order, each in its mark's colour", () => {
    const { container } = render(<BootSequence phrase="x" />);
    const flyers = [...container.querySelectorAll("[data-boot-fly]")];
    expect(flyers.map((f) => f.getAttribute("data-boot-fly"))).toEqual([...chapterIds]);
    flyers.forEach((flyer, i) => {
      expect(flyer.querySelector("svg")!.getAttribute("class")).toContain(`text-mark-${chapterIds[i]}`);
    });
  });

  it("hands the split time to CSS", () => {
    const { container } = render(<BootSequence phrase="x" />);
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.style.getPropertyValue("--boot-split-at")).toBe(`${bootTimeline.split.at}ms`);
    expect(overlay.style.getPropertyValue("--boot-trace-duration")).toBe(`${bootTimeline.trace.duration}ms`);
  });

  it("is part of the desk, in the desk's language", () => {
    render(<Desk locale="en" dict={getDictionary("en")} counts={{ dev: 0, infra: 0, repair: 0, creative: 0 }} />);
    expect(document.querySelector(".boot-phrase")).toHaveTextContent("Everything starts with an empty folder.");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("boot styles", () => {
  it("hide the sequence unless the runtime asked for it", () => {
    expect(css).toMatch(/\.boot\s*\{\s*display:\s*none;\s*\}/);
    expect(css).toMatch(/html\[data-boot="play"\] \.boot\s*\{/);
  });

  it("hold until the split, on the animation the runtime waits for", () => {
    expect(css).toContain(`@keyframes ${BOOT_HOLD_ANIMATION}`);
    expect(css).toMatch(new RegExp(`animation: ${BOOT_HOLD_ANIMATION} var\\(--boot-split-at\\)`));
  });

  it("keep the desk's own folders hidden until theirs land", () => {
    expect(css).toMatch(/html\[data-boot="play"\] \[data-chapter-mark\] svg\s*\{\s*opacity:\s*0;/);
  });

  it("never show it under reduced motion, whatever the runtime did", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\[data-boot\] \.boot\s*\{\s*display:\s*none;/);
  });
});
