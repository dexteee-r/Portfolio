import { siGithub, siInstagram } from "simple-icons";

/**
 * The footer's contact icons. Monochrome, in the text's own colour — the
 * frame has no colour but the four marks, and a chapter recolours them with
 * its ink. Decorative: each sits beside the words it illustrates, and those
 * words name the link. Brand glyphs come unaltered from Simple Icons (CC0).
 */

const BRANDS = {
  instagram: siInstagram.path,
  github: siGithub.path,
} as const;

export type Brand = keyof typeof BRANDS;

interface IconProps {
  className?: string;
}

/** An envelope, drawn with the same fine line as the site's folders. */
export function MailIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function BrandIcon({ brand, className }: IconProps & { brand: Brand }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d={BRANDS[brand]} />
    </svg>
  );
}
