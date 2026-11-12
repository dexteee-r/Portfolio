import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { projectPath } from "@/i18n/paths";
import { contentRoot, ContentError, showDrafts, type LocalizedProject } from "./projects";
import { projectStatuses } from "./schema";
import { machineForms, networkKinds, type HomelabNode, type NetworkNode } from "./network-layout";
import { SLUG_PATTERN } from "./slug";

/**
 * The homelab, as the Homelab chapter shows it: machines and services, each
 * hanging from the one that hosts or serves it — a tree, from the Internet
 * down. A physical machine has a silhouette (form), and may say what it is
 * and where it stands; any node may name the project about it. One content
 * file, edited in the CMS: content/infra/network.yaml.
 *
 * Names only. The site is public: an address or a port in any text fails the
 * build, so the page can never become a map for someone else.
 *
 * Server only (it reads the disk); the shape, which the page needs too, lives
 * in network-layout.ts.
 */

export { machineForms, networkKinds } from "./network-layout";
export type { HomelabNode, MachineForm, NetworkKind, NetworkNode } from "./network-layout";

export const NETWORK_FILE = path.join("infra", "network.yaml");
export const NETWORK_MAX_NODES = 24;
export const LABEL_MAX_LENGTH = 32;
/** A machine's hardware or zone: one line under its name. */
export const FACT_MAX_LENGTH = 60;

/** An IPv4 or IPv6 address, or a :port — never in a public drawing. */
const ADDRESS = /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b|:\d{2,5}\b/i;

const publicText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((text) => !ADDRESS.test(text), "may not hold an address or a port");

const translated = z.object({ fr: publicText(FACT_MAX_LENGTH), en: publicText(FACT_MAX_LENGTH) }).strict();

const nodeSchema = z
  .object({
    id: z.string().regex(SLUG_PATTERN, "id: lowercase letters, digits and single hyphens"),
    label: publicText(LABEL_MAX_LENGTH),
    kind: z.enum(networkKinds),
    parent: z.string().optional(),
    form: z.enum(machineForms).optional(),
    hardware: translated.optional(),
    zone: translated.optional(),
    project: z.string().regex(SLUG_PATTERN, "project: a project's slug").optional(),
  })
  .strict() satisfies z.ZodType<NetworkNode>; // checks exactly the shape the page draws

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

/**
 * The nodes as a page shows them: their facts in its language, and a link to
 * the project each one names — only when that project is shown too.
 */
export function localizeNetwork(nodes: NetworkNode[], locale: Locale, projects: LocalizedProject[]): HomelabNode[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  return nodes.map(({ hardware, zone, project: slug, ...node }) => {
    const project = slug ? bySlug.get(slug) : undefined;
    return {
      ...node,
      ...(hardware ? { hardware: hardware[locale] } : {}),
      ...(zone ? { zone: zone[locale] } : {}),
      ...(project
        ? {
            project: {
              href: projectPath(locale, project.chapter, project.slug),
              title: project.title,
              ...(project.lang === locale ? {} : { lang: project.lang }),
            },
          }
        : {}),
    };
  });
}
