"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { layoutList, layoutTree, type NetworkNode, type Placed } from "@/content/network-layout";
import type { Dictionary } from "@/i18n/dictionaries";

/** Units of the wide drawing: columns, rows, margins. */
const TREE = { column: 230, row: 128, left: 40, top: 48, label: 230 } as const;
/** Units of the narrow drawing: one row per node, an indent per level. */
const LIST = { row: 60, indent: 30, left: 22, top: 30, width: 360 } as const;
/** Pace of the drawing: each level after the one above it; siblings a beat apart. */
export const LEVEL_DELAY_MS = 320;
export const SIBLING_DELAY_MS = 60;
/** The tracking lock visits one node after another, this far apart. */
export const TRACK_STEP_S = 1.25;

interface Point {
  x: number;
  y: number;
}

function delays(placed: Placed[]) {
  const seenAtDepth = new Map<number, number>();
  return new Map(
    placed.map((p) => {
      const sibling = seenAtDepth.get(p.depth) ?? 0;
      seenAtDepth.set(p.depth, sibling + 1);
      return [p.node.id, p.depth * LEVEL_DELAY_MS + sibling * SIBLING_DELAY_MS] as const;
    }),
  );
}

/** Corner brackets around a point: the tracker has it. */
function Brackets({ size }: { size: number }) {
  const arm = size * 0.4;
  return (
    <g className="net-brackets text-chapter-accent" stroke="currentColor" fill="none">
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sy]) => (
        <path key={`${sx}${sy}`} d={`M${sx! * size} ${sy! * (size - arm)}V${sy! * size}H${sx! * (size - arm)}`} />
      ))}
    </g>
  );
}

function Node({
  placed,
  at,
  delay,
  index,
  dict,
}: {
  placed: Placed;
  at: Point;
  delay: number;
  index: number;
  dict: Dictionary;
}) {
  const style = { "--delay": `${delay}ms`, "--track-delay": `${index * TRACK_STEP_S + 1.5}s` } as CSSProperties;
  // Two groups: a CSS transform would replace the SVG one that places the node.
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <g className="net-node" style={style}>
        <path d="M-7 0H7M0 -7V7" stroke="currentColor" className="text-chapter-ink" />
        <Brackets size={placed.depth === 0 ? 20 : 15} />
        <text x={26} y={-4} className="fill-chapter-ink font-mono" fontSize={15}>
          {placed.node.label}
        </text>
        <text x={26} y={14} className="fill-chapter-muted font-mono uppercase" fontSize={10} letterSpacing={1.2}>
          {dict.network.kinds[placed.node.kind]}
        </text>
      </g>
    </g>
  );
}

function Drawing({
  placed,
  point,
  link,
  viewBox,
  className,
  dict,
}: {
  placed: Placed[];
  point: (p: Placed) => Point;
  link: (from: Point, to: Point) => string;
  viewBox: string;
  className: string;
  dict: Dictionary;
}) {
  const byId = new Map(placed.map((p) => [p.node.id, p]));
  const wait = delays(placed);
  return (
    <svg viewBox={viewBox} className={className} strokeWidth={1.5} aria-hidden="true" focusable="false">
      {placed
        .filter((p) => p.node.parent)
        .map((p) => {
          const parent = byId.get(p.node.parent!)!;
          const style = { "--delay": `${Math.max(0, wait.get(p.node.id)! - LEVEL_DELAY_MS * 0.8)}ms` } as CSSProperties;
          return (
            <path
              key={p.node.id}
              className="net-line text-chapter-muted"
              style={style}
              d={link(point(parent), point(p))}
              pathLength={1}
              stroke="currentColor"
              fill="none"
            />
          );
        })}
      {placed.map((p, index) => (
        <Node key={p.node.id} placed={p} at={point(p)} delay={wait.get(p.node.id)!} index={index} dict={dict} />
      ))}
    </svg>
  );
}

/** The tree for screen readers: the same nesting, in words. */
function Outline({ nodes, parent, dict }: { nodes: NetworkNode[]; parent?: string; dict: Dictionary }): ReactNode {
  const level = nodes.filter((node) => node.parent === parent);
  if (level.length === 0) return null;
  return (
    <ul>
      {level.map((node) => (
        <li key={node.id}>
          {node.label} — {dict.network.kinds[node.kind]}
          <Outline nodes={nodes} parent={node.id} dict={dict} />
        </li>
      ))}
    </ul>
  );
}

interface NetworkMapProps {
  dict: Dictionary;
  nodes: NetworkNode[];
}

/**
 * The infra chapter's one effect: the homelab drawn like a tracking screen —
 * each machine held in cyan brackets, joined to the one that hosts it. When it
 * comes into view the lines trace themselves level by level and each node
 * locks on; then the tracker keeps visiting them, one at a time.
 *
 * Drawn from the start without JavaScript or under reduced motion. A tree on
 * wide screens, a file-tree list on a phone; for screen readers, the same
 * nesting as a list.
 */
export function NetworkMap({ dict, nodes }: NetworkMapProps) {
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = figure.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Hidden until seen — only now that the script is here to reveal it.
    element.setAttribute("data-armed", "");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.setAttribute("data-drawn", "");
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tree = layoutTree(nodes);
  const columns = Math.max(...tree.map((p) => p.x)) + 1;
  const levels = Math.max(...tree.map((p) => p.depth)) + 1;
  const treeWidth = TREE.left + (columns - 1) * TREE.column + TREE.label;
  const treeHeight = TREE.top + (levels - 1) * TREE.row + 50;

  const list = layoutList(nodes);
  const listHeight = LIST.top + (list.length - 1) * LIST.row + 40;

  return (
    <figure ref={figure} data-network="" className="mt-12 max-w-content md:mt-16">
      <Drawing
        dict={dict}
        placed={tree}
        viewBox={`0 0 ${treeWidth} ${treeHeight}`}
        className="hidden h-auto w-full md:block"
        point={(p) => ({ x: TREE.left + p.x * TREE.column, y: TREE.top + p.y * TREE.row })}
        // Down, across below the parent's label, down again: no line crosses a word.
        link={(from, to) => `M${from.x} ${from.y}V${from.y + TREE.row * 0.55}H${to.x}V${to.y}`}
      />
      <Drawing
        dict={dict}
        placed={list}
        viewBox={`0 0 ${LIST.width} ${listHeight}`}
        className="h-auto w-full md:hidden"
        point={(p) => ({ x: LIST.left + p.x * LIST.indent, y: LIST.top + p.y * LIST.row })}
        link={(from, to) => `M${from.x} ${from.y}V${to.y}H${to.x}`}
      />
      <figcaption className="mt-4 font-mono text-2xs uppercase tracking-label text-chapter-muted">
        {dict.network.caption}
      </figcaption>
      <div className="sr-only">
        <Outline nodes={nodes} dict={dict} />
      </div>
    </figure>
  );
}
