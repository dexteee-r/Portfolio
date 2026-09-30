import type { Page } from "@playwright/test";

/**
 * Waits until every animation that ends has ended — the chapters' effects
 * play once, on arrival or when seen — so a check such as axe's contrast
 * reads the page as it stays, not a frame caught halfway. Endless ones
 * (the network map's tracker) are left running.
 */
export function settled(page: Page): Promise<unknown> {
  return page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 10_000 },
  );
}

/**
 * Everything that sticks out sideways — including text clipped by an
 * `overflow: clip` ancestor, which a scrollWidth check on <html> never sees.
 * Returns a readable description of each offender; empty means clean.
 */
export function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders: string[] = [];
    const describe = (el: Element, detail: string) =>
      `${el.tagName.toLowerCase()} ${detail} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
    // Content inside a deliberate sideways scroller (the drawer on a phone, a
    // wide table) is meant to extend past the screen; the scroller itself is
    // still checked like any other box.
    const insideScroller = (el: Element) => {
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };

    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (el.closest("[data-stage-leaving], .sr-only, svg")) continue;
      if (insideScroller(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;

      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > viewport + 1 || box.left < -1) {
        offenders.push(describe(el, `box ${Math.round(box.left)}→${Math.round(box.right)} of ${viewport}`));
        continue;
      }
      // Text that does not fit its own box. Only elements that hold text
      // themselves: a child box enlarged on purpose (a wider hit area with
      // negative margins) is not clipped text. Inline boxes report
      // clientWidth 0, so only block-level boxes are measured.
      const ownsText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      // A declared ellipsis is a deliberate cut, not an accident.
      const textual = ownsText && style.display !== "inline" && style.textOverflow !== "ellipsis";
      if (textual && el.scrollWidth > el.clientWidth + 1 && style.overflowX !== "auto" && style.overflowX !== "scroll") {
        offenders.push(describe(el, `text ${el.scrollWidth}px in ${el.clientWidth}px`));
      }
    }
    return offenders;
  });
}
