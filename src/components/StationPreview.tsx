"use client";

import { useEffect, useRef, useState } from "react";
import { luma, SAMPLE_WIDTH, trackMotion, type Motion } from "@/lib/motion";

/** The tracker looks at this many frames a second: smooth to the eye, easy on the battery. */
export const TRACKING_FPS = 15;
/** Two grids, like a tracker locking on at two scales: fine boxes within coarse ones. */
export const TRACKING_CELLS = [4, 8] as const;
/** How strongly the moving cells are tinted with the chapter's colour. */
const TINT_ALPHA = 0.45;
/** The boxes' labels, in CSS pixels. */
const LABEL_PX = 9;

const playVideo = (video: HTMLVideoElement | null) => {
  // Refused (no user gesture, low power mode…): the cover simply stays.
  void video?.play().catch(() => {});
};
const pauseVideo = (video: HTMLVideoElement | null) => video?.pause();

export interface TrackingColours {
  /** Boxes and labels: the chapter's ink. */
  ink: string;
  /** Moving cells: the chapter's one colour. */
  accent: string;
  font: string;
}

/**
 * Paints one frame of the tracker: the moving cells of the finest grid,
 * tinted, then every box of every grid, thin, each with the share of its
 * pixels that moved.
 */
export function drawTracking(context: CanvasRenderingContext2D, motions: Motion[], colours: TrackingColours, scale = 1) {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  const [fine] = motions;
  if (!fine) return;

  context.globalAlpha = TINT_ALPHA;
  context.fillStyle = colours.accent;
  for (const cell of fine.cells) {
    context.fillRect(
      cell.col * fine.cellWidth * width,
      cell.row * fine.cellHeight * height,
      fine.cellWidth * width + 1,
      fine.cellHeight * height + 1,
    );
  }

  context.globalAlpha = 0.9;
  context.strokeStyle = colours.ink;
  context.fillStyle = colours.ink;
  context.lineWidth = scale;
  context.font = `${LABEL_PX * scale}px ${colours.font}`;
  context.textBaseline = "top";
  for (const motion of motions) {
    for (const blob of motion.blobs) {
      const x = Math.round(blob.x * width) + 0.5;
      const y = Math.round(blob.y * height) + 0.5;
      context.strokeRect(x, y, Math.round(blob.w * width), Math.round(blob.h * height));
      context.fillText(`${Math.round(blob.share * 100)}%`, x + 2 * scale, y + 2 * scale);
    }
  }
  context.globalAlpha = 1;
}

interface StationPreviewProps {
  src: string;
  /** The button's visible word: "Aperçu". */
  label: string;
  /** Its full name, for screen readers: "Aperçu — Vlog Malaisie". */
  name: string;
  /** The creative chapter's effect: motion tracking over the clip. */
  tracking: boolean;
}

/**
 * The station's video cursor: a short, silent clip played over the cover it
 * replaces — on hover with a mouse, with the Preview button everywhere else
 * (a finger, a keyboard). Never on its own on a phone, never on hover under
 * reduced motion; loaded only once it is asked to play, paused out of view.
 *
 * In the creative chapter, the clip is tracked as it plays (inspi:
 * animation › nickjaykdesign): what moves is tinted amber and boxed, each
 * box with the share of it that moved. Computed from the frames themselves.
 */
export function StationPreview({ src, label, name, tracking }: StationPreviewProps) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = video.current;
    const station = root.current?.closest<HTMLElement>("[data-station]");
    if (!element || !station) return;
    const hover = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const enter = () => {
      if (hover?.matches && !reduced?.matches) playVideo(element);
    };
    const leave = () => {
      if (hover?.matches) pauseVideo(element);
    };
    station.addEventListener("pointerenter", enter);
    station.addEventListener("pointerleave", leave);
    // Out of sight, out of play.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry && !entry.isIntersecting) pauseVideo(element);
          });
    observer?.observe(station);
    return () => {
      station.removeEventListener("pointerenter", enter);
      station.removeEventListener("pointerleave", leave);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    const canvas = overlay.current;
    if (!tracking || !playing || !element || !canvas) return;
    const context = canvas.getContext("2d");
    const sampler = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!context || !sampler) return;

    const style = getComputedStyle(canvas);
    const colours = {
      ink: style.color,
      accent: style.getPropertyValue("--chapter-accent").trim() || style.color,
      font: style.fontFamily,
    };
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    let previous: Uint8Array | null = null;
    let last = 0;
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      if (now - last < 1000 / TRACKING_FPS || element.readyState < 2 || !element.videoWidth) return;
      last = now;

      const width = SAMPLE_WIDTH;
      const height = Math.max(1, Math.round((SAMPLE_WIDTH * element.videoHeight) / element.videoWidth));
      if (sampler.canvas.width !== width || sampler.canvas.height !== height) {
        sampler.canvas.width = width;
        sampler.canvas.height = height;
        previous = null;
      }
      const boxWidth = Math.round(canvas.clientWidth * scale);
      const boxHeight = Math.round(canvas.clientHeight * scale);
      if (canvas.width !== boxWidth || canvas.height !== boxHeight) {
        canvas.width = boxWidth;
        canvas.height = boxHeight;
      }

      sampler.drawImage(element, 0, 0, width, height);
      const current = luma(sampler.getImageData(0, 0, width, height).data);
      if (previous) {
        const before = previous;
        drawTracking(
          context,
          TRACKING_CELLS.map((cell) => trackMotion(before, current, width, height, cell)),
          colours,
          scale,
        );
      }
      previous = current;
    });
    return () => {
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [playing, tracking]);

  return (
    <div ref={root} data-preview="" data-playing={playing ? "" : undefined} className="absolute inset-0">
      <video
        ref={video}
        muted
        playsInline
        loop
        preload="none"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        className="preview-video absolute inset-0 size-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={src} type={src.endsWith(".webm") ? "video/webm" : "video/mp4"} />
      </video>
      {tracking && (
        <canvas
          ref={overlay}
          aria-hidden="true"
          className="preview-tracking absolute inset-0 size-full font-mono text-chapter-ink"
        />
      )}
      <button
        type="button"
        aria-pressed={playing}
        aria-label={name}
        onClick={() => (video.current?.paused ? playVideo(video.current) : pauseVideo(video.current))}
        className="absolute right-3 bottom-3 z-10 rounded-sm bg-chapter-bg px-2 py-1 font-mono text-2xs uppercase tracking-label text-chapter-ink"
      >
        <span aria-hidden="true">{playing ? "❚❚ " : "▶ "}</span>
        {label}
      </button>
    </div>
  );
}
