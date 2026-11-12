/**
 * The homelab's shape, with nothing that touches the disk: the chapter's
 * machines are drawn from it (components/homelab). Reading and checking the
 * content file is network.ts's job, on the server.
 */

export const networkKinds = [
  "internet",
  "router",
  "proxy",
  "hypervisor",
  "server",
  "nas",
  "vm",
  "container",
  "service",
] as const;
export type NetworkKind = (typeof networkKinds)[number];

/** A machine's silhouette, as the chapter draws it: no detail that would claim a model. */
export const machineForms = ["mini-pc", "tower", "box"] as const;
export type MachineForm = (typeof machineForms)[number];

/** A short text in each of the site's languages. */
export interface Translated {
  fr: string;
  en: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  kind: NetworkKind;
  /** The node that hosts or serves this one; absent only on the root. */
  parent?: string;
  /** A physical machine: its silhouette. Only machines have one. */
  form?: MachineForm;
  /** A machine's hardware, as already published. */
  hardware?: Translated;
  /** Where a machine stands: open to the internet, or never. */
  zone?: Translated;
  /** The slug of the project that bears this node's name. */
  project?: string;
}

/** A node as the page shows it: in its language, its project as a link. */
export interface HomelabNode {
  id: string;
  label: string;
  kind: NetworkKind;
  parent?: string;
  form?: MachineForm;
  hardware?: string;
  zone?: string;
  project?: { href: string; title: string; lang?: string };
}
