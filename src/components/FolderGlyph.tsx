/** The folder's outline, shared by the chapter marks and the boot sequence. */
export const FOLDER_VIEWBOX = "0 0 64 50";
export const FOLDER_BACK =
  "M4 3.5h17.5l5 5.5H60a2.5 2.5 0 0 1 2.5 2.5v34A2.5 2.5 0 0 1 60 48H4a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 4 3.5Z";
export const FOLDER_FRONT = "M1.5 15.5h61";

interface FolderGlyphProps {
  className?: string;
}

/**
 * The folder every project started as. Drawn in currentColor so the chapter
 * mark sets its colour; decorative, since the link text carries the meaning.
 * `pathLength` is normalised to 1 so the boot sequence can trace it.
 */
export function FolderGlyph({ className }: FolderGlyphProps) {
  return (
    <svg
      viewBox={FOLDER_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path data-part="back" pathLength={1} d={FOLDER_BACK} fill="currentColor" fillOpacity={0.07} />
      <path data-part="front" pathLength={1} d={FOLDER_FRONT} />
    </svg>
  );
}
