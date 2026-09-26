/** First focusable element on every page; invisible until focused. */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-chapter-bg focus:px-3 focus:py-2 focus:text-sm focus:text-chapter-ink"
    >
      {label}
    </a>
  );
}
