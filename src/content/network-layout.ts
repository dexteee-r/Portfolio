/**
 * The homelab's shape, with nothing that touches the disk: the browser draws
 * it (components/NetworkMap). Reading and checking the content file is
 * network.ts's job, on the server.
 */

export const networkKinds = ["internet", "router", "proxy", "hypervisor", "vm", "container", "service"] as const;
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
  /** Row. */
  y: number;
  depth: number;
}

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
