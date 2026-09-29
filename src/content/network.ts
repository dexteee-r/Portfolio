import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { contentRoot, ContentError, showDrafts } from "./projects";
import { projectStatuses } from "./schema";
import { networkKinds, type NetworkNode } from "./network-layout";
import { SLUG_PATTERN } from "./slug";

/**
 * The homelab, as the infra chapter draws it: machines and services, each
 * hanging from the one that hosts or serves it — a tree, from the Internet
 * down. One content file, edited in the CMS: content/infra/network.yaml.
 *
 * Names only. The site is public: an address or a port in a label fails the
 * build, so the drawing can never become a map for someone else.
 *
 * Server only (it reads the disk); the shape and its layout, which the
 * browser needs too, live in network-layout.ts.
 */

export { networkKinds } from "./network-layout";
export type { NetworkKind, NetworkNode } from "./network-layout";

export const NETWORK_FILE = path.join("infra", "network.yaml");
export const NETWORK_MAX_NODES = 24;
export const LABEL_MAX_LENGTH = 32;

/** An IPv4 or IPv6 address, or a :port — never in a public drawing. */
const ADDRESS = /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b|:\d{2,5}\b/i;

const nodeSchema = z
  .object({
    id: z.string().regex(SLUG_PATTERN, "id: lowercase letters, digits and single hyphens"),
    label: z
      .string()
      .trim()
      .min(1)
      .max(LABEL_MAX_LENGTH)
      .refine((label) => !ADDRESS.test(label), "a label may not hold an address or a port"),
    kind: z.enum(networkKinds),
    parent: z.string().optional(),
  })
  .strict() satisfies z.ZodType<NetworkNode>; // checks exactly the shape the browser draws

const networkSchema = z
  .object({
    status: z.enum(projectStatuses),
    nodes: z.array(nodeSchema).min(1).max(NETWORK_MAX_NODES),
  })
  .strict();

export type Network = z.infer<typeof networkSchema>;

/** The tree's own rules: one root, every parent known, no loop. */
export function treeProblems(nodes: NetworkNode[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) problems.push(`"${node.id}" appears twice`);
    ids.add(node.id);
  }
  const roots = nodes.filter((node) => !node.parent);
  if (roots.length !== 1) problems.push(`one node without a parent expected, found ${roots.length}`);
  for (const node of nodes) {
    if (node.parent && !ids.has(node.parent)) problems.push(`"${node.id}" hangs from unknown "${node.parent}"`);
    if (node.parent === node.id) problems.push(`"${node.id}" hangs from itself`);
  }
  // Walk up from every node: a loop never reaches the root.
  const parentOf = new Map(nodes.map((node) => [node.id, node.parent]));
  for (const node of nodes) {
    const seen = new Set<string>();
    let current: string | undefined = node.id;
    while (current && !seen.has(current)) {
      seen.add(current);
      current = parentOf.get(current);
    }
    if (current) {
      problems.push(`"${node.id}" is part of a loop`);
      break;
    }
  }
  return problems;
}

export function parseNetwork(source: string, file = NETWORK_FILE): Network {
  let data: unknown;
  try {
    data = parse(source);
  } catch (error) {
    throw new ContentError(`${file}: invalid YAML — ${(error as Error).message}`);
  }
  const parsed = networkSchema.safeParse(data);
  if (!parsed.success) throw new ContentError(`${file}: ${z.prettifyError(parsed.error)}`);
  const problems = treeProblems(parsed.data.nodes);
  if (problems.length > 0) throw new ContentError(`${file}: ${problems.join("; ")}`);
  return parsed.data;
}

/**
 * The homelab's nodes to draw, or null: no file, or a draft outside
 * development — the drawing appears once it is right.
 */
export function loadNetwork(root: string = contentRoot(), includeDrafts: boolean = showDrafts()): NetworkNode[] | null {
  const file = path.join(root, NETWORK_FILE);
  if (!existsSync(file)) return null;
  const network = parseNetwork(readFileSync(file, "utf8"));
  return network.status === "published" || includeDrafts ? network.nodes : null;
}
