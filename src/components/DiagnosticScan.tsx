"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import type { Dimensions } from "@/content/media";
import type { ScanMarker } from "@/content/schema";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { interpolate } from "@/lib/interpolate";

/** A box this close to the top gets its label inside, not above and cut off. */
export const LABEL_INSIDE_BELOW = 8;
/** A box starting this far right gets its label on its right edge, not past the photo. */
export const LABEL_RIGHT_FROM = 60;
/** The photo never stands taller than this share of the screen. */
const MAX_HEIGHT_VH = 80;

const pad = (n: number) => String(n).padStart(2, "0");

interface DiagnosticScanProps {
  cover: string;
  alt: string;
  /** Language the description is written in, when it is not the page's. */
  lang?: Locale;
  size: Dimensions;
  sizes: string;
  markers: ScanMarker[];
  /** Language the labels are written in, when it is not the page's. */
  markersLang?: Locale;
  copy: Dictionary["projectPage"]["scan"];
  className?: string;
}

/**
 * The repair chapter's effect (inspi: animation › thermal scan, brought back
 * to brick): the cover photo, seen through a diagnostic scanner. A line
 * sweeps down it once, when it comes into view, and each repaired part it
 * passes locks into a box, named.
 *
 * The photo keeps its own proportions, so the boxes — placed in percent of
 * the photo — land where they were drawn. The scanner is decoration; the
 * parts it names are also said in words, for screen readers. Without
 * JavaScript, or under reduced motion, the boxes are simply there.
 */
export function DiagnosticScan({
  cover,
  alt,
  lang,
  size,
  sizes,
  markers,
  markersLang,
  copy,
  className = "",
}: DiagnosticScanProps) {
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = figure.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // The boxes wait, hidden, only now that the script is here to reveal them.
    element.setAttribute("data-armed", "");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.setAttribute("data-scanned", "");
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ratio = size.width / size.height;
  const parts = markers.map((marker, index) => (
    <span key={index}>
      {index > 0 && ", "}
      {marker.label}
    </span>
  ));

  return (
    <figure ref={figure} data-scan="" className={className}>
      <div
        className="relative overflow-hidden rounded-sm bg-chapter-surface"
        style={{ aspectRatio: `${size.width} / ${size.height}`, width: `min(100%, ${MAX_HEIGHT_VH * ratio}vh)` }}
      >
        <Image
          src={cover}
          alt={alt}
          lang={lang}
          fill
          sizes={sizes}
          className="object-cover"
          loading="eager"
          fetchPriority="high"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 font-mono text-2xs leading-none uppercase tracking-label"
        >
          {/* The viewfinder's corners, and what it is doing. */}
          <span className="absolute top-3 left-3 size-4 border-t-2 border-l-2 border-chapter-accent" />
          <span className="absolute top-3 right-3 size-4 border-t-2 border-r-2 border-chapter-accent" />
          <span className="absolute bottom-3 left-3 size-4 border-b-2 border-l-2 border-chapter-accent" />
          <span className="absolute right-3 bottom-3 size-4 border-r-2 border-b-2 border-chapter-accent" />
          <span className="absolute bottom-4 left-9 bg-chapter-bg px-1 py-0.5 text-chapter-ink">{copy.mode}</span>
          <span data-scan-count="" className="absolute right-9 bottom-4 bg-chapter-bg px-1 py-0.5 text-chapter-ink">
            {copy.parts} {pad(markers.length)}
          </span>

          <div className="scan-sweep absolute inset-0" />

          {markers.map((marker, index) => (
            <div
              key={index}
              data-scan-mark=""
              className="scan-mark absolute"
              style={
                {
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  width: `${marker.w}%`,
                  height: `${marker.h}%`,
                  // When the sweeping line reaches the box.
                  "--at": marker.y / 100,
                } as CSSProperties
              }
            >
              {/* The box closes in; its name appears whole once it has — never half-faded, never hard to read. */}
              <span className="scan-box absolute inset-0 border-2 border-chapter-accent" />
              <span
                lang={markersLang}
                data-scan-label=""
                className={`scan-label absolute whitespace-nowrap bg-chapter-bg px-1 py-0.5 text-chapter-accent-text ${
                  marker.y < LABEL_INSIDE_BELOW ? "top-0" : "bottom-full mb-0.5"
                } ${marker.x >= LABEL_RIGHT_FROM ? "right-0" : "left-0"}`}
              >
                {pad(index + 1)} {marker.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">
        {interpolate(copy.caption, { parts: <span lang={markersLang}>{parts}</span> })}
      </figcaption>
    </figure>
  );
}
