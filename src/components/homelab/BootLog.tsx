"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/webgl";

/** Lines the log keeps on screen; a line every this many milliseconds. */
export const BOOT_ROWS = 9;
export const BOOT_STEP_MS = 34;

/** The log as it stands once `count` lines have been printed: the last rows, each stamped with its time. */
export function bootFrame(lines: string[], count: number): string {
  const end = Math.min(count, lines.length);
  const shown = lines.slice(Math.max(0, end - BOOT_ROWS), end);
  const first = end - shown.length;
  return shown.map((line, i) => `[${(0.031 * (first + i)).toFixed(3).padStart(7)}] ${line}`).join("\n");
}

/**
 * The homelab booting, above the chapter's title: one line per machine and
 * service, run through in about half a second. Printed in full from the
 * start — in the HTML, under reduced motion; replayed once the script is here.
 */
export function BootLog({ lines }: { lines: string[] }) {
  const [count, setCount] = useState(lines.length);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // From its first line again: the HTML's full log shows only until the first tick.
    let printed = 0;
    const timer = setInterval(() => {
      printed += 1;
      setCount(printed);
      if (printed >= lines.length) clearInterval(timer);
    }, BOOT_STEP_MS);
    return () => clearInterval(timer);
  }, [lines]);

  return (
    <pre aria-hidden="true" data-boot-log="" className="homelab-boot">
      {bootFrame(lines, count)}
    </pre>
  );
}
