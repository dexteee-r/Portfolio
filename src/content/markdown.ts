import type { Definition, Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { COVER_PATTERN } from "./schema";

/** Where a link in a project text may lead. */
const SAFE_LINK = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;

export interface MarkdownReport {
  /** Every image the text shows, in order. */
  images: Array<{ url: string; alt: string }>;
  /** Everything that must be fixed before the text can be published. */
  problems: string[];
}

/**
 * Reads a project text the way the page will render it and lists what cannot
 * ship: images outside the media pipeline or without a description, links to
 * anything but the web, mail or the site itself, and raw HTML — which the
 * renderer would print as text rather than obey.
 */
export function inspectMarkdown(markdown: string): MarkdownReport {
  const tree = fromMarkdown(markdown);
  const definitions = new Map<string, Definition>();
  visit(tree, "definition", (node: Definition) => {
    definitions.set(node.identifier, node);
  });

  const images: MarkdownReport["images"] = [];
  const problems: string[] = [];

  const image = (url: string, alt: string) => {
    images.push({ url, alt });
    if (!COVER_PATTERN.test(url)) {
      problems.push(`image "${url}" must be /media/….avif, .webp or .png (lowercase, no JPEG, no remote file)`);
    }
    if (!alt.trim()) problems.push(`image "${url}" has no description (alt text)`);
  };

  visit(tree, (node: Nodes) => {
    switch (node.type) {
      case "image":
        image(node.url, node.alt ?? "");
        break;
      case "imageReference": {
        // CommonMark only forms a reference when its definition exists;
        // an undefined one stays plain text.
        const definition = definitions.get(node.identifier);
        if (definition) image(definition.url, node.alt ?? "");
        break;
      }
      case "link":
      case "definition":
        if (!SAFE_LINK.test(node.url)) problems.push(`link "${node.url}" is not http(s), mailto or a site path`);
        break;
      case "html":
        problems.push(`raw HTML is not allowed: ${node.value.trim().slice(0, 40)}`);
        break;
    }
  });

  return { images, problems };
}
