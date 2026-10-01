/**
 * The homelab's shape, with nothing that touches the disk: the browser draws
 * it (components/NetworkMap). Reading and checking the content file is
 * network.ts's job, on the server.
 */

export const networkKinds = ["internet", "router", "proxy", "hypervisor", "nas", "vm", "container", "service"] as const;
export type NetworkKind = (typeof networkKinds)[number];

export interface NetworkNode {
  id: string;
  label: string;
  kind: NetworkKind;
  /** The node that hosts or serves this one; absent only on the root. */
  parent?: string;
}

export interface Placed {
  node: NetworkNode;
  /** Column (tree layout: position among the leaves; list layout: depth). */
  x: number;
  /** Row (tree layout: level). */
  y: number;
  depth: number;
  /** Hybrid layout only: the node's line in the list under its column's head (0: in the tree). */
  line?: number;
  /** Hybrid layout only: how far it is indented in that list. */
  indent?: number;
}

/** Past this many columns, a top-down tree gets too narrow to read. */
export const MAX_TREE_COLUMNS = 5;

function childrenOf(nodes: NetworkNode[]) {
  const children = new Map<string, NetworkNode[]>();
  for (const node of nodes) {
    if (!node.parent) continue;
    children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  }
  return children;
}

/**
 * The tree, top down: each leaf in its own column, in file order; a parent
 * centred over its children; one row per level.
 */
export function layoutTree(nodes: NetworkNode[]): Placed[] {
  const root = nodes.find((node) => !node.parent)!;
  const children = childrenOf(nodes);
  const placed: Placed[] = [];
  let nextLeaf = 0;
  const place = (node: NetworkNode, depth: number): number => {
    const kids = children.get(node.id) ?? [];
    let x: number;
    if (kids.length === 0) x = nextLeaf++;
    else {
      const columns = kids.map((kid) => place(kid, depth + 1));
      x = (columns[0]! + columns[columns.length - 1]!) / 2;
    }
    placed.push({ node, x, y: depth, depth });
    return x;
  };
  place(root, 0);
  return placed.sort((a, b) => nodes.indexOf(a.node) - nodes.indexOf(b.node));
}

/**
 * The tree for a wide screen, kept readable however wide the homelab grows:
 * top down as long as it fits in `maxColumns`; past that, the tree stops at
 * the deepest level that still fits — the machines, say — and everything
 * each of those nodes hosts is listed under it, indented, like a file tree.
 * A homelab that fits is simply the tree.
 */
export function layoutHybrid(nodes: NetworkNode[], maxColumns: number = MAX_TREE_COLUMNS): Placed[] {
  const children = childrenOf(nodes);
  const depthOf = new Map<string, number>();
  const measure = (node: NetworkNode, depth: number) => {
    depthOf.set(node.id, depth);
    for (const kid of children.get(node.id) ?? []) measure(kid, depth + 1);
  };
  measure(nodes.find((node) => !node.parent)!, 0);
  const deepest = Math.max(...depthOf.values());

  // The deepest level the tree can stop at: its leaves — that level, and any
  // shallower node with nothing below — must fit the columns.
  const leavesDownTo = (cut: number) =>
    nodes.filter((node) => {
      const depth = depthOf.get(node.id)!;
      return depth === cut || (depth < cut && !children.has(node.id));
    }).length;
  let cut = deepest;
  while (cut > 0 && leavesDownTo(cut) > maxColumns) cut -= 1;

  const tree = layoutTree(nodes.filter((node) => depthOf.get(node.id)! <= cut));
  const placed: Placed[] = tree.map((p) => ({ ...p, line: 0, indent: 0 }));
  for (const head of tree.filter((p) => p.depth === cut)) {
    let line = 0;
    const list = (node: NetworkNode) => {
      for (const kid of children.get(node.id) ?? []) {
        line += 1;
        const depth = depthOf.get(kid.id)!;
        placed.push({ node: kid, x: head.x, y: cut, depth, line, indent: depth - cut });
        list(kid);
      }
    };
    list(head.node);
  }
  return placed.sort((a, b) => nodes.indexOf(a.node) - nodes.indexOf(b.node));
}

/**
 * The same tree for a narrow screen: one node per row, in reading order,
 * indented by its depth — the shape of a file tree.
 */
export function layoutList(nodes: NetworkNode[]): Placed[] {
  const root = nodes.find((node) => !node.parent)!;
  const children = childrenOf(nodes);
  const placed: Placed[] = [];
  const place = (node: NetworkNode, depth: number) => {
    placed.push({ node, x: depth, y: placed.length, depth });
    for (const kid of children.get(node.id) ?? []) place(kid, depth + 1);
  };
  place(root, 0);
  return placed;
}

/** Parent–child pairs: the lines of the drawing. */
export function networkLinks(nodes: NetworkNode[]): Array<[string, string]> {
  return nodes.filter((node) => node.parent).map((node) => [node.parent!, node.id]);
}
