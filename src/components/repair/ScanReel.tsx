"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Dimensions } from "@/content/media";
import type { ScanMarker } from "@/content/schema";
import type { Locale } from "@/i18n/config";
import { boxInFrame, coverCrop, CYCLE_MS, FRAME_ASPECT, lockedAt, phaseAt } from "@/lib/scan-reel";
import { hasFinePointer, prefersReducedMotion } from "@/lib/webgl";
import { blurPlaceholder } from "../placeholder";
import type { ReelClock } from "./XrayLens";

// The X-ray, in the browser only: WebGL has nothing to draw on the server.
const XrayLens = dynamic(() => import("./XrayLens"), { ssr: false });

/** One repair in the reel: its photo, the parts named on it, and where it leads. */
export interface ReelItem {
  slug: string;
  href: string;
  /** What the link names: the device, or the title. */
  name: string;
  cover: string;
  coverAlt: string;
  /** Language of the description, when it is not the page's. */
  lang?: Locale;
  size: Dimensions;
  markers: ScanMarker[];
  markersLang?: Locale;
}

interface ScanReelProps {
  items: ReelItem[];
  copy: {
    mode: string;
    parts: string;
    seeRepair: string;
    lensHint: string;
    pause: string;
    play: string;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

const REDUCED = "(prefers-reduced-motion: reduce)";
/** The visitor's reduced-motion preference, followed live; the server assumes none. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia?.(REDUCED);
      media?.addEventListener?.("change", onChange);
      return () => media?.removeEventListener?.("change", onChange);
    },
    () => Boolean(window.matchMedia?.(REDUCED).matches),
    () => false,
  );
}

/**
 * The repair world's opening: one repair after another through the
 * diagnostic scanner, every 2.5 seconds — the photo fades in, a line sweeps
 * down it with an X-ray behind it (WebGL), and the parts it names lock into
 * boxes. With a mouse, a lens shows the X-ray under the pointer, and the reel
 * waits while it is used.
 *
 * Moving content that does not stop by itself: it has a pause button, and it
 * waits off screen and in a hidden tab. Under reduced motion it does not run;
 * without JavaScript, the first repair stands still, its boxes drawn.
 */
export function ScanReel({ items, copy }: ScanReelProps) {
  const [index, setIndex] = useState(0);
  // The visitor's own choice wins; until they make one, the reel plays — unless they asked for less motion.
  const [choice, setChoice] = useState<"auto" | "play" | "pause">("auto");
  const reduced = useReducedMotion();
  const playing = choice === "play" || (choice === "auto" && !reduced);
  const frame = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const clock = useRef<ReelClock>({ index: 0, line: -1, keep: 0, lens: { x: 0.5, y: 0.5, on: 0 } });
  const photos = useMemo(
    () => items.map((item) => ({ src: item.cover, width: item.size.width, height: item.size.height })),
    [items],
  );
  const current = items[index] ?? items[0]!;

  useEffect(() => {
    const element = frame.current;
    if (!element || items.length === 0) return;
    element.setAttribute("data-armed", "");
    const still = prefersReducedMotion();

    let onScreen = true;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (onScreen = entry?.isIntersecting ?? true));
    observer?.observe(element);

    // The lens, with a mouse or a pen only: a finger would hide what it shows.
    const fine = hasFinePointer();
    let hovering = false;
    const lensGoal = { on: 0 };
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      clock.current.lens.x = (event.clientX - box.left) / box.width;
      clock.current.lens.y = (event.clientY - box.top) / box.height;
      lensGoal.on = 1;
      hovering = true;
    };
    const leave = () => {
      lensGoal.on = 0;
      hovering = false;
    };
    if (fine) {
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);
      element.setAttribute("data-lens", "");
    }
    // A keyboard on the reel's link or button holds it too: what it reads must not change under it.
    const figure = element.parentElement!;
    let focused = false;
    const focusIn = () => (focused = true);
    const focusOut = () => (focused = false);
    figure.addEventListener("focusin", focusIn);
    figure.addEventListener("focusout", focusOut);

    let elapsed = 0;
    let last = performance.now();
    let shownIndex = clock.current.index;
    let id = 0;
    const tick = (now: number) => {
      id = requestAnimationFrame(tick);
      const delta = now - last;
      last = now;
      clock.current.lens.on += (lensGoal.on - clock.current.lens.on) * 0.2;
      // The clock only runs while the reel plays, is seen, and no one is looking through the lens.
      if (playing && onScreen && !document.hidden && !hovering && !focused) elapsed += delta;
      if (elapsed >= CYCLE_MS) {
        elapsed -= CYCLE_MS;
        shownIndex = (shownIndex + 1) % items.length;
        clock.current.index = shownIndex;
        setIndex(shownIndex);
      }
      const phase = still || !playing ? { line: -1, keep: 0 } : phaseAt(elapsed);
      clock.current.line = phase.line;
      clock.current.keep = phase.keep;
      const bar = line.current;
      if (bar) {
        const sweeping = phase.line >= 0 && phase.line < 1;
        bar.style.top = `${Math.max(0, phase.line) * 100}%`;
        bar.style.opacity = sweeping ? "1" : "0";
      }
      // Each box locks as the line reaches it — all of them when the reel stands still.
      for (const mark of element.querySelectorAll<HTMLElement>(`[data-item="${shownIndex}"] [data-reel-mark]`)) {
        const top = Number(mark.dataset.top) / 100;
        mark.toggleAttribute("data-locked", !playing || still || lockedAt(elapsed, top));
      }
    };
    id = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(id);
      observer?.disconnect();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      element.removeAttribute("data-lens");
      figure.removeEventListener("focusin", focusIn);
      figure.removeEventListener("focusout", focusOut);
    };
  }, [items, playing]);

  if (items.length === 0) return null;

  return (
    <figure data-reel="" className="workbench-scan">
      <div
        ref={frame}
        className="relative overflow-hidden rounded-sm bg-chapter-bg"
        style={{ aspectRatio: `${FRAME_ASPECT}` }}
      >
        {items.map((item, i) => {
          const crop = coverCrop(item.size.width, item.size.height);
          return (
            <div
              key={item.slug}
              data-item={i}
              data-current={i === index ? "" : undefined}
              aria-hidden={i === index ? undefined : true}
              className="reel-item absolute inset-0"
            >
              <Image
                src={item.cover}
                alt={item.coverAlt}
                lang={item.lang}
                fill
                sizes="(min-width: 1024px) 34rem, 100vw"
                className="object-cover"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                {...blurPlaceholder(item.size.blur)}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 font-mono text-2xs uppercase tracking-label">
                {item.markers.map((marker, m) => {
                  const box = boxInFrame(marker, crop);
                  if (!box) return null;
                  return (
                    <span
                      key={m}
                      data-reel-mark=""
                      data-top={box.y}
                      className="reel-mark absolute"
                      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` } as CSSProperties}
                    >
                      <span className="absolute inset-0 border-2 border-chapter-accent" />
                      <span
                        lang={item.markersLang}
                        className={`absolute whitespace-nowrap bg-chapter-bg px-1 py-0.5 leading-none text-chapter-accent-text ${
                          box.y < 8 ? "top-0" : "bottom-full mb-0.5"
                        } ${box.x >= 60 ? "right-0" : "left-0"}`}
                      >
                        {pad(m + 1)} {marker.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        <XrayLens photos={photos} clock={clock} />
        <div ref={line} aria-hidden="true" className="reel-line" />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 font-mono text-2xs leading-none uppercase tracking-label"
        >
          <span className="absolute top-3 left-3 size-4 border-t-2 border-l-2 border-chapter-accent" />
          <span className="absolute top-3 right-3 size-4 border-t-2 border-r-2 border-chapter-accent" />
          <span className="absolute bottom-3 left-3 size-4 border-b-2 border-l-2 border-chapter-accent" />
          <span className="absolute right-3 bottom-3 size-4 border-r-2 border-b-2 border-chapter-accent" />
          <span className="absolute bottom-4 left-9 bg-chapter-bg px-1 py-0.5 text-chapter-ink">{copy.mode}</span>
          <span data-reel-count="" className="absolute right-9 bottom-4 bg-chapter-bg px-1 py-0.5 text-chapter-ink">
            {pad(index + 1)} / {pad(items.length)}
          </span>
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 font-mono text-2xs uppercase tracking-label text-chapter-muted">
        <Link href={current.href} className="text-chapter-accent-text hover:underline">
          {copy.seeRepair.replace("{device}", current.name)} →
        </Link>
        <span className="flex items-baseline gap-4">
          <span aria-hidden="true" className="hidden pointer-fine:inline">
            {copy.lensHint}
          </span>
          {items.length > 1 && (
            <button
              type="button"
              data-reel-toggle=""
              onClick={() => setChoice(playing ? "pause" : "play")}
              className="rounded-sm border border-chapter-line px-2 py-1 uppercase tracking-label text-chapter-ink hover:border-chapter-muted"
            >
              {playing ? copy.pause : copy.play}
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
