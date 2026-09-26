import type { ReactElement } from "react";
import { FOLDER_BACK, FOLDER_FRONT, FOLDER_VIEWBOX } from "@/components/FolderGlyph";
import type { Palette } from "../tokens";
import { CARD_SIZE, CONTENT_WIDTH, INSET, SAFE_SQUARE, TITLE_MAX_LINES, TITLE_TRACKING_EM } from "./layout";
import { titleSize } from "./measure";

export { CARD_SIZE, CONTENT_WIDTH, SAFE_SQUARE, TITLE_MAX, TITLE_MIN } from "./layout";
export { titleLines, titleSize, titleWidth } from "./measure";

/**
 * Share cards, drawn by Satori at build time (next/og). Each page gets its own
 * from its title and chapter; nothing is made by hand, so a project added
 * through the CMS shares properly from day one.
 *
 * - No photo behind the text: at the size of a messaging thumbnail, a title on
 *   a busy picture is unreadable, and pages without pictures share just as well.
 * - Everything that matters sits in the centred square: several messaging apps
 *   crop the card to a square.
 * - A title is sized from its real measured width (./measure): every word
 *   whole on its line, three lines at most.
 */

const UI = "Schibsted Grotesk";
const MONO = "DM Mono";

function Folder({ width, stroke, colour }: { width: number; stroke: number; colour: string }) {
  return (
    <svg viewBox={FOLDER_VIEWBOX} width={width} height={(width * 50) / 64}>
      <path d={FOLDER_BACK} fill={colour} fillOpacity={0.08} stroke={colour} strokeWidth={stroke} strokeLinejoin="round" />
      <path d={FOLDER_FRONT} fill="none" stroke={colour} strokeWidth={stroke} />
    </svg>
  );
}

function Frame({ palette, children }: { palette: Palette; children: ReactElement[] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        background: palette.bg,
        color: palette.ink,
        fontFamily: UI,
      }}
    >
      <div
        data-safe-square=""
        style={{
          width: SAFE_SQUARE.width,
          height: CARD_SIZE.height,
          padding: INSET,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Footer({ palette }: { palette: Palette }) {
  return (
    <div style={{ display: "flex", fontFamily: MONO, fontSize: 24, letterSpacing: 3, color: palette.muted }}>
      elmzn.be
    </div>
  );
}

interface PageCardProps {
  palette: Palette;
  /** Small line above the title, beside the accent dot: the chapter's name. */
  eyebrow: string;
  title: string;
  /** Optional line under the title. */
  subtitle?: string;
}

/** A chapter or a project: its grade, its chapter in small, its title very large. */
export function PageCard({ palette, eyebrow, title, subtitle }: PageCardProps) {
  const size = titleSize(title);
  return (
    <Frame palette={palette}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div data-accent-dot="" style={{ width: 14, height: 14, borderRadius: 7, background: palette.accent }} />
        <div
          style={{
            display: "flex",
            fontFamily: MONO,
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: palette.muted,
          }}
        >
          {eyebrow}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: CONTENT_WIDTH }}>
        <div
          style={{
            display: "block",
            fontSize: size,
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: TITLE_TRACKING_EM * size,
            lineClamp: TITLE_MAX_LINES,
            wordBreak: "break-word",
            maxWidth: CONTENT_WIDTH,
            color: palette.ink,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ display: "block", fontSize: 26, lineHeight: 1.35, lineClamp: 3, color: palette.muted }}>
            {subtitle}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
      <Footer palette={palette} />
    </Frame>
  );
}

interface DeskCardProps {
  palette: Palette;
  name: string;
  identity: string;
  /** The four marks' colours, in desk order. */
  marks: string[];
}

/** The desk: the light frame, the name, the identity line and the four folders. */
export function DeskCard({ palette, name, identity, marks }: DeskCardProps) {
  return (
    <Frame palette={palette}>
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 22, letterSpacing: 3, color: palette.muted }}>
        ELMZN
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: CONTENT_WIDTH }}>
        <div style={{ display: "flex", fontSize: 120, fontWeight: 600, lineHeight: 1.04, letterSpacing: -4.2 }}>{name}</div>
        <div style={{ display: "block", fontSize: 26, lineHeight: 1.35, lineClamp: 3, color: palette.muted }}>
          {identity}
        </div>
        <div data-marks="" style={{ display: "flex", gap: 28, marginTop: 12 }}>
          {marks.map((colour) => (
            <Folder key={colour} width={76} stroke={1.6} colour={colour} />
          ))}
        </div>
      </div>
      <Footer palette={palette} />
    </Frame>
  );
}

/** Stroke, in folder units, that renders at a legible width whatever the icon size. */
export function iconStroke(size: number): number {
  const folderWidth = size * 0.72;
  const rendered = Math.max(2, size / 36);
  return (rendered * 64) / folderWidth;
}

/** Favicon and home-screen icon: the grey folder of the boot sequence, on the frame. */
export function IconCard({ palette, size }: { palette: Palette; size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: palette.bg,
      }}
    >
      <Folder width={size * 0.72} stroke={iconStroke(size)} colour={palette.ink} />
    </div>
  );
}
