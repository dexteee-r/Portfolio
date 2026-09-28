/* eslint-disable @next/next/no-html-link-for-pages --
   The fake views stand for what next/link renders in the browser: plain
   anchors. The stage must work on those, whatever produced them. */
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAVIGATION_TIMEOUT_MS, SETTLE_MARGIN_MS, ViewStage } from "@/components/ViewStage";
import type { TransitionContext } from "@/lib/transitions";

const nav = vi.hoisted(() => ({
  pathname: "/fr",
  push: (() => {}) as (...args: unknown[]) => void,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: (...args: unknown[]) => nav.push(...args) }),
}));

const motion = vi.hoisted(() => ({
  duration: 560,
  calls: [] as Array<{ ctx: TransitionContext; pinned: string; release: () => void }>,
  /** Views the quiet page transition was run on. */
  quiet: [] as HTMLElement[],
  /** Chapters slid back up after a pull let go too early. */
  returned: [] as Array<{ view: HTMLElement; offset: number; transformAtStart: string }>,
  /** When false, the transition only ends when a test releases it. */
  autoResolve: true,
}));
vi.mock("@/lib/transitions", () => ({
  transitionDuration: () => motion.duration,
  pageTransitionDuration: () => (motion.duration ? 260 : 0),
  runTransition: (ctx: TransitionContext) =>
    new Promise<void>((resolve) => {
      motion.calls.push({ ctx, pinned: ctx.arriving.style.position, release: resolve });
      if (motion.autoResolve) resolve();
    }),
  runPageTransition: (view: HTMLElement) => {
    motion.quiet.push(view);
    return Promise.resolve();
  },
  returnSheet: (view: HTMLElement, offset: number) => {
    motion.returned.push({ view, offset, transformAtStart: view.style.transform });
    return Promise.resolve();
  },
}));

const push = vi.fn();

beforeEach(() => {
  nav.pathname = "/fr";
  nav.push = push;
  push.mockReset();
  motion.duration = 560;
  motion.calls = [];
  motion.quiet = [];
  motion.returned = [];
  motion.autoResolve = true;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const Desk = () => (
  <div data-view="frame" id="desk-root">
    <h1>Markus</h1>
    <nav>
      <a href="/fr/dev" data-chapter-mark="dev" id="mark-dev">
        Dev
      </a>
      <a href="/fr/infra" data-chapter-mark="infra">
        Infra
      </a>
    </nav>
    <a href="/en">EN</a>
    <a href="#content">skip</a>
  </div>
);

const Chapter = ({ id = "dev" }: { id?: string }) => (
  <div data-view="chapter" data-chapter={id}>
    <h1 data-view-title="" tabIndex={-1}>
      {id}
    </h1>
    <a href="/fr">back</a>
    <a href="/fr/infra">other chapter</a>
    <article data-station="first-project">
      <h2>
        <a href={`/fr/${id}/first-project`}>first station</a>
      </h2>
    </article>
    <article data-station="some-project">
      <h2>
        <a href={`/fr/${id}/some-project`} id="station-link">
          station
        </a>
      </h2>
    </article>
    <input aria-label="field" />
  </div>
);

const ProjectPage = ({ slug = "some-project" }: { slug?: string }) => (
  <div data-view="project" data-chapter="dev">
    <h1 data-view-title="" tabIndex={-1}>
      {slug}
    </h1>
    <a href="/fr" id="logo">
      ELMZN
    </a>
    <a href="/fr/dev">back to chapter</a>
    <a href="/fr/dev/first-project">previous</a>
  </div>
);

function stage(view: ReactNode) {
  return <ViewStage>{view}</ViewStage>;
}

const layer = () => document.querySelector<HTMLElement>("[data-stage-leaving]");
const liveView = () => document.querySelector<HTMLElement>("[data-stage-views] [data-view]")!;

/** Lets pending promise callbacks (.finally) run. */
const flush = () => act(async () => {});

describe("desk → chapter (in)", () => {
  it("takes over the click, freezes the desk and navigates without scrolling", () => {
    render(stage(<Desk />));
    const notPrevented = fireEvent.click(document.getElementById("mark-dev")!);

    expect(notPrevented).toBe(false);
    expect(push).toHaveBeenCalledExactlyOnceWith("/fr/dev", { scroll: false });

    const frozen = layer();
    expect(frozen).not.toBeNull();
    expect(frozen).toHaveAttribute("aria-hidden", "true");
    expect(frozen).toHaveAttribute("inert");
    expect(frozen!.style.position).toBe("fixed");
    expect(frozen!.querySelector("[id]")).toBeNull(); // no duplicate ids
    expect(frozen!.querySelector("[data-view]")).toBeNull(); // never mistaken for the live view
    expect(frozen!.style.zIndex < "30").toBe(true); // the desk stays under the chapter
  });

  it("runs the drawer once the chapter is in the DOM, then cleans up and focuses its title", async () => {
    const { rerender } = render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    const frozen = layer()!;

    nav.pathname = "/fr/dev";
    rerender(stage(<Chapter />));

    expect(motion.calls).toHaveLength(1);
    const { ctx, pinned } = motion.calls[0]!;
    expect(ctx.direction).toBe("in");
    expect(ctx.leaving).toBe(frozen);
    expect(ctx.arriving).toBe(liveView());
    expect(ctx.origin?.id).toBe("mark-dev");
    expect(pinned).toBe("fixed");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);

    await flush();
    expect(layer()).toBeNull();
    expect(liveView().getAttribute("style") ?? "").toBe("");
    expect(document.activeElement).toBe(document.querySelector("[data-view-title]"));
  });

  it("keeps the chapter at its start position until the animation takes over", () => {
    motion.autoResolve = false;
    const { rerender } = render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    nav.pathname = "/fr/dev";
    rerender(stage(<Chapter />));
    expect(liveView().style.transform).toBe("translateY(100%)");
    expect(liveView().style.zIndex).toBe("30");
  });
});

describe("chapter → desk (out)", () => {
  beforeEach(() => {
    nav.pathname = "/fr/dev";
  });

  it("closes with Escape and returns focus to the folder of origin", async () => {
    const { rerender } = render(stage(<Chapter />));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(push).toHaveBeenCalledExactlyOnceWith("/fr", { scroll: false });
    expect(layer()!.style.zIndex).toBe("30"); // the chapter sheet stays on top

    nav.pathname = "/fr";
    rerender(stage(<Desk />));
    expect(motion.calls[0]!.ctx.direction).toBe("out");

    await flush();
    expect(layer()).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("mark-dev"));
  });

  it("closes from the back link too", () => {
    render(stage(<Chapter />));
    fireEvent.click(document.querySelector('a[href="/fr"]')!);
    expect(push).toHaveBeenCalledWith("/fr", { scroll: false });
  });

  it("ignores Escape while typing, with modifiers, or when already handled", () => {
    render(stage(<Chapter />));
    fireEvent.keyDown(document.querySelector("input")!, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape", ctrlKey: true });
    const handled = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    handled.preventDefault();
    document.dispatchEvent(handled);
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores Escape on the desk", () => {
    nav.pathname = "/fr";
    render(stage(<Desk />));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ordinary navigations stay ordinary", () => {
  it.each([
    ["a language switch", "/fr", <Desk key="d" />, 'a[href="/en"]'],
    ["an anchor", "/fr", <Desk key="d" />, 'a[href="#content"]'],
    ["another chapter", "/fr/dev", <Chapter key="c" />, 'a[href="/fr/infra"]'],
    ["a station", "/fr/dev", <Chapter key="c" />, 'a[href="/fr/dev/some-project"]'],
  ])("%s", (_, path, view, selector) => {
    nav.pathname = path;
    render(stage(view));
    const notPrevented = fireEvent.click(document.querySelector(selector)!);
    expect(notPrevented).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(layer()).toBeNull();
  });

  it("a ctrl-click opens a new tab as usual", () => {
    render(stage(<Desk />));
    expect(fireEvent.click(document.getElementById("mark-dev")!, { ctrlKey: true })).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("inside a chapter: the quiet transition", () => {
  it("station → project: no drawer, a quiet fade, focus on the project's title", () => {
    nav.pathname = "/fr/dev";
    const { rerender } = render(stage(<Chapter />));
    expect(fireEvent.click(document.getElementById("station-link")!)).toBe(true); // next/link navigates

    nav.pathname = "/fr/dev/some-project";
    rerender(stage(<ProjectPage />));

    expect(motion.calls).toHaveLength(0);
    expect(layer()).toBeNull();
    expect(motion.quiet).toEqual([liveView()]);
    expect(document.activeElement).toBe(document.querySelector("[data-view-title]"));
  });

  it("project → chapter: brings the station of origin back into view and focuses it", () => {
    nav.pathname = "/fr/dev/some-project";
    const { rerender } = render(stage(<ProjectPage />));

    nav.pathname = "/fr/dev";
    rerender(stage(<Chapter />));

    const station = document.querySelector('[data-station="some-project"]')!;
    expect(station.scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(document.activeElement).toBe(document.getElementById("station-link"));
    expect(motion.quiet).toHaveLength(1);
  });

  it("project → project in the same chapter is quiet too", () => {
    nav.pathname = "/fr/dev/some-project";
    const { rerender } = render(stage(<ProjectPage />));
    nav.pathname = "/fr/dev/first-project";
    rerender(stage(<ProjectPage slug="first-project" />));
    expect(motion.quiet).toHaveLength(1);
    expect(motion.calls).toHaveLength(0);
  });

  it("a language switch is not animated at all", () => {
    nav.pathname = "/fr/dev/some-project";
    const { rerender } = render(stage(<ProjectPage />));
    nav.pathname = "/en/dev/some-project";
    rerender(stage(<ProjectPage />));
    expect(motion.quiet).toHaveLength(0);
    expect(motion.calls).toHaveLength(0);
  });

  it("Escape on a project climbs one level, to its chapter — without the drawer", () => {
    nav.pathname = "/fr/dev/some-project";
    render(stage(<ProjectPage />));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(push).toHaveBeenCalledExactlyOnceWith("/fr/dev");
    expect(layer()).toBeNull();
  });

  it("the logo on a project page goes back to the desk with the drawer", async () => {
    nav.pathname = "/fr/dev/some-project";
    const { rerender } = render(stage(<ProjectPage />));
    expect(fireEvent.click(document.getElementById("logo")!)).toBe(false);
    expect(push).toHaveBeenCalledWith("/fr", { scroll: false });
    expect(layer()).not.toBeNull();

    nav.pathname = "/fr";
    rerender(stage(<Desk />));
    expect(motion.calls[0]!.ctx.direction).toBe("out");
    await flush();
    expect(document.activeElement).toBe(document.getElementById("mark-dev"));
  });
});

describe("pages of the frame (the legal notice)", () => {
  const Legal = () => (
    <div data-view="frame">
      <h1 data-view-title="" tabIndex={-1}>
        Mentions légales
      </h1>
      <a href="/fr">back</a>
    </div>
  );

  const ChapterWithFooter = () => (
    <div data-view="chapter" data-chapter="dev">
      <h1 data-view-title="" tabIndex={-1}>
        dev
      </h1>
      <footer>
        <a href="/fr/mentions-legales" id="legal-link">
          Mentions légales
        </a>
      </footer>
    </div>
  );

  it("from a chapter: the drawer closes onto the page, and focus lands on its title", async () => {
    nav.pathname = "/fr/dev";
    const { rerender } = render(stage(<ChapterWithFooter />));
    const notPrevented = fireEvent.click(document.getElementById("legal-link")!);
    expect(notPrevented).toBe(false);
    expect(push).toHaveBeenCalledExactlyOnceWith("/fr/mentions-legales", { scroll: false });

    nav.pathname = "/fr/mentions-legales";
    rerender(stage(<Legal />));
    expect(motion.calls[0]!.ctx.direction).toBe("out");

    await flush();
    expect(layer()).toBeNull();
    expect(document.activeElement).toBe(document.querySelector("[data-view-title]"));
  });

  it("from the desk: same ground, no motion, but focus still moves to its title", () => {
    const { rerender } = render(stage(<Desk />));
    nav.pathname = "/fr/mentions-legales";
    rerender(stage(<Legal />));
    expect(motion.calls).toHaveLength(0);
    expect(motion.quiet).toHaveLength(0);
    expect(document.activeElement).toBe(document.querySelector("[data-view-title]"));
  });

  it("Escape goes back to the desk, without the drawer", () => {
    nav.pathname = "/fr/mentions-legales";
    render(stage(<Legal />));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(push).toHaveBeenCalledExactlyOnceWith("/fr");
    expect(layer()).toBeNull();
  });
});

describe("pulling a chapter down (touch)", () => {
  /** Dispatches a touch event with the given fingers, at time `t` (ms). Returns false if prevented. */
  function touch(type: string, points: Array<[number, number]>, t: number, target: Element = liveView()): boolean {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const touches = points.map(([clientX, clientY]) => ({ clientX, clientY }));
    Object.defineProperty(event, "touches", { value: touches });
    Object.defineProperty(event, "timeStamp", { value: t });
    return target.dispatchEvent(event);
  }

  /** A steady pull straight down by `distance` px, 4 px every 16 ms. Returns whether every move was prevented. */
  function pullDown(distance: number, from = 100): boolean {
    let prevented = true;
    touch("touchstart", [[200, from]], 0);
    let t = 0;
    for (let d = 4; d <= distance; d += 4) {
      t += 16;
      const notPrevented = touch("touchmove", [[200, from + d]], t);
      if (d > 12) prevented &&= !notPrevented;
    }
    touch("touchend", [], t + 5);
    return prevented;
  }

  const html = document.documentElement;

  beforeEach(() => {
    nav.pathname = "/fr/dev";
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    html.removeAttribute("data-pulling");
  });

  it("follows the finger, the light frame showing above, and keeps the page from scrolling", () => {
    render(stage(<Chapter />));
    touch("touchstart", [[200, 100]], 0);
    touch("touchmove", [[200, 140]], 100);
    const notPrevented = touch("touchmove", [[200, 250]], 300);
    expect(notPrevented).toBe(false);
    expect(liveView().style.transform).toBe("translateY(140px)"); // 150 pulled, minus the slop
    expect(html).toHaveAttribute("data-pulling");
  });

  it("let go far enough: the drawer takes over from there, onto the desk", async () => {
    const { rerender } = render(stage(<Chapter />));
    expect(pullDown(320)).toBe(true);

    expect(push).toHaveBeenCalledExactlyOnceWith("/fr", { scroll: false });
    const frozen = layer()!;
    expect(frozen.style.transform).toBe("translateY(310px)"); // exactly where the finger left it
    expect(frozen.firstElementChild!.getAttribute("style")).not.toContain("translateY"); // the offset is the layer's alone
    expect(html).toHaveAttribute("data-pulling");

    nav.pathname = "/fr";
    rerender(stage(<Desk />));
    expect(motion.calls[0]!.ctx).toMatchObject({ direction: "out", offset: 310, leaving: frozen });

    await flush();
    expect(layer()).toBeNull();
    expect(html).not.toHaveAttribute("data-pulling");
    expect(document.activeElement).toBe(document.getElementById("mark-dev"));
  });

  it("a short flick closes it too", () => {
    render(stage(<Chapter />));
    touch("touchstart", [[200, 100]], 0);
    touch("touchmove", [[200, 130]], 20);
    touch("touchmove", [[200, 180]], 40);
    touch("touchmove", [[200, 240]], 60);
    touch("touchend", [], 62);
    expect(push).toHaveBeenCalledWith("/fr", { scroll: false });
  });

  it("let go too early: the chapter slides back up and the frame is hidden again", () => {
    render(stage(<Chapter />));
    pullDown(60);
    expect(push).not.toHaveBeenCalled();
    expect(motion.returned).toHaveLength(1);
    expect(motion.returned[0]).toMatchObject({ offset: 50, transformAtStart: "" });
    expect(liveView().style.transform).toBe("");
    expect(html).not.toHaveAttribute("data-pulling");
  });

  it("a tap is not a pull", () => {
    render(stage(<Chapter />));
    touch("touchstart", [[200, 100]], 0);
    touch("touchmove", [[202, 103]], 16);
    touch("touchend", [], 30);
    expect(push).not.toHaveBeenCalled();
    expect(motion.returned).toEqual([]);
    expect(liveView().style.transform).toBe("");
  });

  it("below the top of the page, pulling down is scrolling: left to the browser", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 300 });
    render(stage(<Chapter />));
    touch("touchstart", [[200, 100]], 0);
    expect(touch("touchmove", [[200, 300]], 200)).toBe(true);
    touch("touchend", [], 400);
    expect(liveView().style.transform).toBe("");
    expect(push).not.toHaveBeenCalled();
  });

  it("upward and sideways moves are left to the browser", () => {
    render(stage(<Chapter />));
    touch("touchstart", [[200, 300]], 0);
    expect(touch("touchmove", [[200, 200]], 100)).toBe(true);
    expect(touch("touchmove", [[200, 600]], 300)).toBe(true); // the gesture was a scroll: it stays one
    touch("touchend", [], 400);
    touch("touchstart", [[100, 100]], 1000);
    expect(touch("touchmove", [[300, 140]], 1100)).toBe(true);
    expect(liveView().style.transform).toBe("");
    expect(push).not.toHaveBeenCalled();
  });

  it("only a chapter can be pulled: not the desk, not a project page", () => {
    nav.pathname = "/fr";
    const { unmount } = render(stage(<Desk />));
    pullDown(400);
    expect(push).not.toHaveBeenCalled();
    unmount();
    nav.pathname = "/fr/dev/some-project";
    render(stage(<ProjectPage />));
    pullDown(400);
    expect(push).not.toHaveBeenCalled();
    expect(liveView().style.transform).toBe("");
  });

  it("a second finger, or a cancelled touch, puts the chapter back", () => {
    render(stage(<Chapter />));
    touch("touchstart", [[200, 100]], 0);
    touch("touchmove", [[200, 200]], 100);
    touch("touchmove", [[200, 210], [300, 210]], 120);
    expect(motion.returned).toHaveLength(1);
    expect(liveView().style.transform).toBe("");

    touch("touchstart", [[200, 100]], 1000);
    touch("touchmove", [[200, 200]], 1100);
    touch("touchcancel", [], 1150);
    expect(motion.returned).toHaveLength(2);
    expect(html).not.toHaveAttribute("data-pulling");
    expect(push).not.toHaveBeenCalled();
  });

  it("while the drawer is already moving, the finger does nothing", () => {
    render(stage(<Chapter />));
    fireEvent.keyDown(document, { key: "Escape" }); // the drawer starts
    push.mockClear();
    pullDown(400);
    expect(push).not.toHaveBeenCalled();
    expect(liveView().style.transform).toBe("");
  });

  it("reduced motion: the finger still moves the chapter, the rest is instant", async () => {
    motion.duration = 0;
    const { rerender } = render(stage(<Chapter />));
    pullDown(320);
    expect(push).toHaveBeenCalledWith("/fr", { scroll: false });
    expect(layer()).toBeNull();

    nav.pathname = "/fr";
    rerender(stage(<Desk />));
    expect(motion.calls).toHaveLength(0);
    expect(html).not.toHaveAttribute("data-pulling");
    expect(document.activeElement).toBe(document.getElementById("mark-dev"));
  });

  it("a navigation that never lands hands the chapter back, in place", () => {
    vi.useFakeTimers();
    render(stage(<Chapter />));
    pullDown(320);
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS + 1);
    expect(layer()).toBeNull();
    expect(liveView().style.transform).toBe("");
    expect(html).not.toHaveAttribute("data-pulling");
  });
});

describe("reduced motion", () => {
  it("swaps instantly — no frozen copy, no animation — but still moves focus", () => {
    motion.duration = 0;
    const { rerender } = render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    expect(push).toHaveBeenCalledOnce();
    expect(layer()).toBeNull();

    nav.pathname = "/fr/dev";
    rerender(stage(<Chapter />));
    expect(motion.calls).toHaveLength(0);
    expect(document.activeElement).toBe(document.querySelector("[data-view-title]"));
  });
});

describe("robustness", () => {
  it("runs one drawer at a time", () => {
    render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    const second = fireEvent.click(document.querySelector('a[href="/fr/infra"]')!);
    expect(second).toBe(false);
    expect(push).toHaveBeenCalledOnce();
    expect(document.querySelectorAll("[data-stage-leaving]")).toHaveLength(1);
  });

  it("ignores clicks while the drawer is still moving", () => {
    motion.autoResolve = false;
    const { rerender } = render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    nav.pathname = "/fr/dev";
    rerender(stage(<Chapter />));
    push.mockReset();

    expect(fireEvent.click(document.querySelector('a[href="/fr"]')!)).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(push).not.toHaveBeenCalled();
  });

  it("hands the page back if the navigation never lands", () => {
    vi.useFakeTimers();
    render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    expect(layer()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS);
    });
    expect(layer()).toBeNull();

    fireEvent.click(document.getElementById("mark-dev")!);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("forces the drawer to its end when animations do not advance (hidden tab)", async () => {
    vi.useFakeTimers();
    motion.autoResolve = false;
    const finish = vi.fn(() => motion.calls[0]!.release());
    const original = HTMLElement.prototype.getAnimations;
    HTMLElement.prototype.getAnimations = () => [{ finish, cancel: () => {} } as unknown as Animation];

    try {
      const { rerender } = render(stage(<Desk />));
      fireEvent.click(document.getElementById("mark-dev")!);
      nav.pathname = "/fr/dev";
      rerender(stage(<Chapter />));
      expect(layer()).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(motion.duration + SETTLE_MARGIN_MS);
      });
      await flush();

      expect(finish).toHaveBeenCalled();
      expect(layer()).toBeNull();
      expect(liveView().getAttribute("style") ?? "").toBe("");
    } finally {
      HTMLElement.prototype.getAnimations = original;
    }
  });

  it("removes a frozen copy if the stage goes away mid-navigation", () => {
    const { unmount } = render(stage(<Desk />));
    fireEvent.click(document.getElementById("mark-dev")!);
    expect(layer()).not.toBeNull();
    unmount();
    expect(layer()).toBeNull();
  });
});
