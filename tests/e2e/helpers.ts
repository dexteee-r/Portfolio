import type { Page } from "@playwright/test";

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

    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (el.closest("[data-stage-leaving], .sr-only, svg")) continue;
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
