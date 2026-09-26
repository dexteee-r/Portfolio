import type { CSSProperties } from "react";
import { chapterIds, type ChapterId } from "@/content/chapters";
import { bootTimeline, nameWindows } from "@/lib/boot";
import { FOLDER_BACK, FOLDER_FRONT, FOLDER_VIEWBOX, FolderGlyph } from "./FolderGlyph";

const ms = (value: number) => `${value}ms`;

/** Written out in full so Tailwind finds every class in the source. */
const MARK_COLOR: Record<ChapterId, string> = {
  dev: "text-mark-dev",
  infra: "text-mark-infra",
  repair: "text-mark-repair",
  creative: "text-mark-creative",
};

/**
 * The first-load sequence. Server-rendered markup, hidden by default and
 * played only when the inline boot runtime has set `data-boot="play"` on
 * <html>: nothing to hydrate, nothing to wait for. Decorative — the desk
 * underneath stays in the accessibility tree the whole time.
 *
 * Layers: the ground (hides the desk, then clears), the centre (the grey
 * folder, its label, the sentence), and the four coloured folders the grey
 * one becomes, which fly to their marks on the desk.
 */
export function BootSequence({ phrase }: { phrase: string }) {
  const { trace, phrase: line, split } = bootTimeline;
  const timing = {
    "--boot-trace-at": ms(trace.at),
    "--boot-trace-duration": ms(trace.duration),
    "--boot-phrase-at": ms(line.at),
    "--boot-phrase-duration": ms(line.duration),
    "--boot-split-at": ms(split.at),
  } as CSSProperties;

  return (
    <div className="boot" aria-hidden="true" data-boot-overlay="" style={timing}>
      <div className="boot-ground" />
      <div className="boot-center">
        <svg className="boot-folder" viewBox={FOLDER_VIEWBOX} focusable="false">
          <path pathLength={1} d={FOLDER_BACK} />
          <path pathLength={1} d={FOLDER_FRONT} />
        </svg>
        <p className="boot-label">
          {nameWindows().map(({ name, at, until }) => (
            <span
              key={name}
              className="boot-name"
              style={{ "--boot-at": ms(at), "--boot-for": ms(until - at) } as CSSProperties}
            >
              {name}
            </span>
          ))}
        </p>
        <p className="boot-phrase">{phrase}</p>
      </div>
      {chapterIds.map((id) => (
        <span key={id} className="boot-fly" data-boot-fly={id}>
          <FolderGlyph className={`${MARK_COLOR[id]} block w-full`} />
        </span>
      ))}
    </div>
  );
}
