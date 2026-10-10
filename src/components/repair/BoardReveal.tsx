"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The work orders, pinned one by one as they come into view: each drops a
 * little onto its pin (globals.css). Only armed by the script, and never
 * under reduced motion — otherwise every order simply hangs there. Only
 * position moves, never opacity: an order is always readable.
 */
export function BoardReveal({ label, children }: { label: string; children: ReactNode }) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const element = list.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...element.children];
    // Orders already on screen stay put: only those scrolled to drop in.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-pinned", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 },
    );
    for (const item of items) {
      const box = item.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) item.setAttribute("data-pinned", "");
      else observer.observe(item);
    }
    element.setAttribute("data-armed", "");
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={list} data-board="" aria-label={label} className="work-board">
      {children}
    </ol>
  );
}
