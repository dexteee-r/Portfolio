"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { clockDateTime, formatClock } from "@/lib/time";

const TICK_MS = 10_000;

function subscribe(onChange: () => void): () => void {
  const id = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(id);
}

interface ClockProps {
  locale: Locale;
  timeZone: string;
  label: string;
}

/**
 * Local time in the top bar. The server does not know the visitor's moment,
 * so it renders a fixed-width placeholder; the real time appears on hydration
 * without a layout shift.
 */
export function Clock({ locale, timeZone, label }: ClockProps) {
  const time = useSyncExternalStore(
    subscribe,
    () => formatClock(new Date(), locale, timeZone),
    () => null,
  );

  return (
    <span className="tabular-nums">
      <span className="sr-only">{label} </span>
      {time === null ? (
        <span aria-hidden="true">--:--</span>
      ) : (
        <time dateTime={clockDateTime(new Date(), timeZone)}>{time}</time>
      )}
    </span>
  );
}
