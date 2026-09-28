import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  pageTransitionDuration,
  pickTechnique,
  returnSheet,
  runPageTransition,
  runTransition,
  techniques,
  transitionDuration,
  type TransitionContext,
} from "@/lib/transitions";

const REDUCED = "(prefers-reduced-motion: reduce)";
const MOBILE = "(max-width: 768px), (pointer: coarse)";

interface Call {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

let calls: Call[];
let media: Record<string, boolean>;
/** Promises handed out as `animation.finished`, in call order. */
let finishers: Array<{ resolve: () => void; reject: (e: unknown) => void }>;
let autoFinish: boolean;
const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  calls = [];
  media = {};
  finishers = [];
  autoFinish = true;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: media[query] ?? false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });

  Element.prototype.animate = function (this: Element, keyframes, options) {
    calls.push({
      el: this,
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    const finished = autoFinish
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => finishers.push({ resolve, reject }));
    return { finished } as unknown as Animation;
  };
});

afterEach(() => {
  Element.prototype.animate = originalAnimate;
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} } as DOMRect;
}

function context(direction: "in" | "out", withOrigin = true): TransitionContext {
  const stage = document.createElement("div");
  const leaving = document.createElement("div");
  const arriving = document.createElement("div");
  const origin = document.createElement("a");
  stage.append(leaving, arriving);
  document.body.append(stage);
  stage.getBoundingClientRect = () => rect(0, 0, 400, 800);
  origin.getBoundingClientRect = () => rect(10, 10, 20, 20);
  return { stage, leaving, arriving, origin: withOrigin ? origin : null, color: "#0d0f1f", direction };
}

function transforms(call: Call | undefined): string[] {
  return (call?.keyframes ?? []).map((k) => String(k.transform));
}

const tokens = readFileSync(join(__dirname, "..", "..", "src", "styles", "tokens.css"), "utf8");
const easeFlood = /--ease-flood:\s*([^;]+);/.exec(tokens)?.[1]?.trim();
const easeStandard = /--ease-standard:\s*([^;]+);/.exec(tokens)?.[1]?.trim();
const durationBase = Number(/--duration-base:\s*(\d+)ms;/.exec(tokens)?.[1]);

describe("technique selection", () => {
  it("ships the drawer on desktop", () => {
    expect(pickTechnique()).toBe("drawer");
    expect(transitionDuration()).toBe(560);
  });

  it("uses the drawer on touch and narrow screens", () => {
    media[MOBILE] = true;
    expect(pickTechnique()).toBe("drawer");
  });

  it("reports a zero duration under reduced motion, so nothing waits", () => {
    media[REDUCED] = true;
    expect(transitionDuration()).toBe(0);
  });
});

describe("runTransition", () => {
  it("does not animate at all under prefers-reduced-motion", async () => {
    media[REDUCED] = true;
    await runTransition(context("in"));
    expect(calls).toHaveLength(0);
  });

  it("resolves only once the animation has finished", async () => {
    autoFinish = false;
    let done = false;
    const running = runTransition(context("in")).then(() => {
      done = true;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(false);

    for (const f of finishers) f.resolve();
    await running;
    expect(done).toBe(true);
  });

  it("never changes the DOM it is given", async () => {
    const ctx = context("in");
    const before = ctx.stage.outerHTML;
    await runTransition(ctx);
    expect(ctx.stage.outerHTML).toBe(before);
  });
});

describe("drawer", () => {
  it("in: the chapter rises from below while the desk recedes", async () => {
    const ctx = context("in");
    await techniques.drawer(ctx);

    const chapter = calls.find((c) => c.el === ctx.arriving);
    const desk = calls.find((c) => c.el === ctx.leaving);
    expect(transforms(chapter)).toEqual(["translateY(100%)", "translateY(0)"]);
    expect(transforms(desk)).toEqual(["scale(1)", "scale(0.965)"]);
  });

  it("out: replays in backwards — the chapter slides down, the desk comes forward", async () => {
    const ctx = context("out");
    await techniques.drawer(ctx);

    const chapter = calls.find((c) => c.el === ctx.leaving);
    const desk = calls.find((c) => c.el === ctx.arriving);
    expect(transforms(chapter)).toEqual(["translateY(0)", "translateY(100%)"]);
    expect(transforms(desk)).toEqual(["scale(0.965)", "scale(1)"]);
  });

  it("out is the exact mirror of in", async () => {
    const inCtx = context("in");
    await techniques.drawer(inCtx);
    const inChapter = transforms(calls.find((c) => c.el === inCtx.arriving));
    const inDesk = transforms(calls.find((c) => c.el === inCtx.leaving));

    calls = [];
    const outCtx = context("out");
    await techniques.drawer(outCtx);
    expect(transforms(calls.find((c) => c.el === outCtx.leaving))).toEqual([...inChapter].reverse());
    expect(transforms(calls.find((c) => c.el === outCtx.arriving))).toEqual([...inDesk].reverse());
  });

  it.each(["in", "out"] as const)("%s animates transform and opacity only", async (direction) => {
    await techniques.drawer(context(direction));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      for (const frame of call.keyframes) {
        for (const property of Object.keys(frame)) {
          expect(["transform", "opacity", "offset", "easing"]).toContain(property);
        }
      }
    }
  });

  it("runs for 560 ms on the --ease-flood curve from tokens.css", async () => {
    await techniques.drawer(context("in"));
    expect(easeFlood).toBeDefined();
    for (const call of calls) {
      expect(call.options.duration).toBe(560);
      expect(call.options.easing).toBe(easeFlood);
      expect(call.options.fill).toBe("forwards");
    }
  });
});

describe("drawer, taken over from a finger (a pull let go)", () => {
  /** The frozen chapter is a viewport-sized layer: 800 px tall here. */
  function pulled(offset: number) {
    const ctx = { ...context("out"), offset };
    ctx.leaving.getBoundingClientRect = () => rect(0, 0, 400, 800);
    return ctx;
  }

  it("carries on from where the chapter was let go, the desk already that much forward", async () => {
    const ctx = pulled(200);
    await techniques.drawer(ctx);
    const chapter = calls.find((c) => c.el === ctx.leaving);
    const desk = calls.find((c) => c.el === ctx.arriving);
    expect(transforms(chapter)).toEqual(["translateY(200px)", "translateY(100%)"]);
    expect(transforms(desk)).toEqual([`scale(${0.965 + (1 - 0.965) * 0.25})`, "scale(1)"]);
  });

  it("takes only the time left for the way left, at the drawer's own pace", async () => {
    const ctx = pulled(200); // a quarter done
    await techniques.drawer(ctx);
    for (const call of calls) {
      expect(call.options.duration).toBe(420);
      expect(call.options.easing).toBe(easeFlood);
      expect(call.options.fill).toBe("forwards");
    }
  });

  it("never snaps, even let go near the bottom", async () => {
    await techniques.drawer(pulled(780));
    for (const call of calls) expect(call.options.duration).toBe(180);
  });

  it("with no offset, is the ordinary drawer", async () => {
    const ctx = pulled(0);
    await techniques.drawer(ctx);
    expect(transforms(calls.find((c) => c.el === ctx.leaving))).toEqual(["translateY(0)", "translateY(100%)"]);
    expect(calls[0]!.options.duration).toBe(560);
  });

  it("is ignored going in: only a chapter can be pulled", async () => {
    const ctx = { ...context("in"), offset: 200 };
    await techniques.drawer(ctx);
    expect(transforms(calls.find((c) => c.el === ctx.arriving))).toEqual(["translateY(100%)", "translateY(0)"]);
  });
});

describe("returnSheet (a pull let go too early)", () => {
  it("slides the chapter back to the top with the quiet transition's pace", async () => {
    const view = document.createElement("div");
    await returnSheet(view, 120);
    expect(calls).toHaveLength(1);
    expect(transforms(calls[0])).toEqual(["translateY(120px)", "translateY(0)"]);
    expect(calls[0]!.options.duration).toBe(durationBase);
    expect(calls[0]!.options.fill).toBeUndefined(); // ends on the view's own style: no transform
  });

  it("does nothing under reduced motion, or with nothing to undo", async () => {
    media[REDUCED] = true;
    await returnSheet(document.createElement("div"), 120);
    media[REDUCED] = false;
    await returnSheet(document.createElement("div"), 0);
    expect(calls).toEqual([]);
  });
});

describe("disc (ready, not shipped)", () => {
  it("grows a 40px disc from the clicked mark and removes it afterwards", async () => {
    const ctx = context("in");
    autoFinish = false;
    const running = techniques.disc(ctx);

    const overlay = ctx.stage.lastElementChild as HTMLElement;
    expect(overlay).not.toBe(ctx.arriving);
    expect(overlay.style.width).toBe("40px");
    expect(overlay.style.height).toBe("40px");
    expect(overlay.style.left).toBe("20px");
    expect(overlay.style.top).toBe("20px");
    expect(overlay.style.pointerEvents).toBe("none");

    finishers[0]!.resolve();
    await running;
    expect(ctx.stage.contains(overlay)).toBe(false);
  });

  it("scales far enough to cover the farthest corner of a tall screen", async () => {
    await techniques.disc(context("in"));
    const end = String(calls[0]!.keyframes.at(-1)!.transform);
    const scale = Number(/scale\(([\d.]+)\)/.exec(end)?.[1]);
    const farthest = Math.hypot(400 - 20, 800 - 20);
    expect(scale * 20).toBeGreaterThanOrEqual(farthest);
  });

  it("starts from the centre of the stage when there is no origin", async () => {
    const ctx = context("in", false);
    autoFinish = false;
    const running = techniques.disc(ctx);
    const overlay = ctx.stage.lastElementChild as HTMLElement;
    expect(overlay.style.left).toBe("200px");
    expect(overlay.style.top).toBe("400px");
    finishers[0]!.resolve();
    await running;
  });

  it("cleans up its overlay even if the animation is cancelled", async () => {
    const ctx = context("in");
    autoFinish = false;
    const running = techniques.disc(ctx);
    const overlay = ctx.stage.lastElementChild as HTMLElement;
    finishers[0]!.reject(new DOMException("cancelled", "AbortError"));
    await expect(running).rejects.toThrow("cancelled");
    expect(ctx.stage.contains(overlay)).toBe(false);
  });
});

describe("iris (ready, desktop only)", () => {
  it("closes a circle on the leaving view, from beyond the farthest corner down to 0", async () => {
    const ctx = context("in");
    await techniques.iris(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.el).toBe(ctx.leaving);
    const [open, shut] = calls[0]!.keyframes.map((k) => String(k.clipPath));
    const radius = Number(/circle\(([\d.]+)px/.exec(open!)?.[1]);
    expect(radius).toBeGreaterThanOrEqual(Math.hypot(380, 780));
    expect(shut).toBe("circle(0px at 20px 20px)");
  });
});

describe("quiet page transition (station ↔ project)", () => {
  it("settles the arriving page in with a short fade, on the shared tokens", async () => {
    const page = document.createElement("div");
    await runPageTransition(page);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.el).toBe(page);
    expect(call!.keyframes.map((k) => k.opacity)).toEqual([0, 1]);
    expect(transforms(call)).toEqual(["translateY(12px)", "translateY(0)"]);
    expect(call!.options.duration).toBe(durationBase);
    expect(call!.options.easing).toBe(easeStandard);
    // No fill: once done, the page is exactly as it would be without the fade.
    expect(call!.options.fill ?? "none").toBe("none");
  });

  it("animates opacity and transform only", async () => {
    await runPageTransition(document.createElement("div"));
    for (const frame of calls[0]!.keyframes) {
      for (const property of Object.keys(frame)) expect(["opacity", "transform"]).toContain(property);
    }
  });

  it("is quieter than the signature transition", () => {
    expect(pageTransitionDuration()).toBeLessThan(transitionDuration());
  });

  it("does nothing under reduced motion", async () => {
    media[REDUCED] = true;
    await runPageTransition(document.createElement("div"));
    expect(calls).toHaveLength(0);
    expect(pageTransitionDuration()).toBe(0);
  });
});
