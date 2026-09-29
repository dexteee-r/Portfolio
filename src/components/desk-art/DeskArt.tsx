"use client";

import { useEffect, useRef } from "react";
import { renderDitheredGlobe } from "@/lib/desk-art/pixels";

/** Frames a second: plenty for a slow, stepped turn, easy on the battery. */
export const DESK_ART_FPS = 20;
/** Pixels across the canvas, before it is scaled up. */
export const PIXELS = 128;

/**
 * The desk's globe: the Earth under a 1-bit screen, lit like the chrome skull
 * of the inspiration board, turning once in 40 seconds, Belgium marked.
 * Painted in the element's own text colour — the frame's ink — on transparent
 * paper, so the desk's ground shows through.
 *
 * Decorative. Drawn once and held still under reduced motion; paused when off
 * screen or in a hidden tab. Hidden during the boot sequence and faded in once
 * it ends (globals.css), so the two never compete.
 */
export default function DeskArt() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const draw = (seconds: number) => {
      const [r, g, b] = (getComputedStyle(element).color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
      const mask = renderDitheredGlobe(PIXELS, seconds);
      const image = context.createImageData(PIXELS, PIXELS);
      for (let i = 0; i < mask.length; i += 1) {
        if (mask[i]) image.data.set([r!, g!, b!, 255], i * 4);
      }
      context.putImageData(image, 0, 0);
    };

    draw(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let onScreen = true;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true;
          });
    observer?.observe(element);

    const start = performance.now();
    let last = start;
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      if (!onScreen || document.hidden || now - last < 1000 / DESK_ART_FPS) return;
      last = now;
      draw((now - start) / 1000);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <div data-desk-art="globe" aria-hidden="true" className="size-full">
      <canvas
        ref={canvas}
        width={PIXELS}
        height={PIXELS}
        className="size-full text-chapter-ink [image-rendering:pixelated]"
      />
    </div>
  );
}
