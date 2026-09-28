import { Fragment, type ReactNode } from "react";

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills the `{key}` placeholders of a dictionary string with text or elements
 * — links, mostly — so a sentence keeps its word order in every language. A
 * placeholder without a value is left as written; tests check that every
 * template gets all of its values.
 */
export function interpolate(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/).filter((part) => part !== "");
  return parts.map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key !== undefined && key in values ? values[key] : part}</Fragment>;
  });
}

/** The placeholders a template uses, in order of first appearance. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1]!))];
}
