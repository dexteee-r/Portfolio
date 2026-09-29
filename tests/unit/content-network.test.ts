import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { ContentError } from "@/content/projects";
import { loadNetwork, NETWORK_FILE, NETWORK_MAX_NODES, parseNetwork } from "@/content/network";
import { layoutList, layoutTree, networkKinds, networkLinks, type NetworkNode } from "@/content/network-layout";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";

const ROOT = join(__dirname, "..", "..");
const FIXTURES = join(ROOT, "tests", "fixtures", "content");

const node = (id: string, parent?: string, extra: Partial<NetworkNode> = {}): NetworkNode => ({
  id,
  label: id,
  kind: parent ? "container" : "internet",
  ...(parent ? { parent } : {}),
  ...extra,
});
const yaml = (nodes: unknown[], status = "published") => stringify({ status, nodes });
const fails = (nodes: unknown[], message: RegExp) => {
  expect(() => parseNetwork(yaml(nodes))).toThrow(ContentError);
  expect(() => parseNetwork(yaml(nodes))).toThrow(message);
};

describe("the homelab file", () => {
  it("reads a well-formed tree", () => {
    const network = parseNetwork(yaml([node("internet"), node("box", "internet", { kind: "router" }), node("host", "box")]));
    expect(network.nodes.map((n) => n.id)).toEqual(["internet", "box", "host"]);
  });

  it("refuses an address or a port in a label: the site is public", () => {
    for (const label of ["srv1 192.168.1.112", "10.0.0.1", "fe80::1", "npm:81", "grafana :3000"]) {
      fails([node("internet"), node("host", "internet", { label })], /address or a port/);
    }
  });

  it("holds exactly one root, known parents and no loop", () => {
    fails([node("a"), node("b")], /one node without a parent expected, found 2/);
    fails([node("a"), node("b", "ghost")], /hangs from unknown "ghost"/);
    fails([node("a"), node("b", "c"), node("c", "b")], /loop/);
    fails([node("a"), node("b", "a"), node("b", "a")], /appears twice/);
  });

  it("refuses unknown kinds, unknown fields, bad ids and oversized trees", () => {
    fails([node("a", undefined, { kind: "toaster" as never })], /kind/);
    fails([{ ...node("a"), ip: "1.2.3.4" }], /ip/);
    fails([node("Not_A_Slug")], /id/);
    fails(Array.from({ length: NETWORK_MAX_NODES + 1 }, (_, i) => node(`n${i}`, i ? "n0" : undefined)), /nodes/);
  });

  it("says which file is wrong", () => {
    expect(() => parseNetwork("status: [")).toThrow(/network\.yaml: invalid YAML/);
  });

  it("is loaded from content/, hidden while a draft outside development", () => {
    expect(loadNetwork(FIXTURES, false)?.map((n) => n.id)).toContain("internet");
    expect(loadNetwork(join(ROOT, "tests", "fixtures"), true)).toBeNull(); // no file: no drawing
  });

  it("keeps the real homelab file valid (a draft until its owner publishes it)", () => {
    const network = parseNetwork(readFileSync(join(ROOT, "content", NETWORK_FILE), "utf8"));
    expect(network.nodes.length).toBeGreaterThan(1);
    expect(loadNetwork(join(ROOT, "content"), true)).not.toBeNull(); // shown in development
    // …and on the public site only once published.
    expect(loadNetwork(join(ROOT, "content"), false) !== null).toBe(network.status === "published");
  });

  it("names every kind in every language", () => {
    for (const locale of locales) {
      expect(Object.keys(getDictionary(locale).network.kinds).sort()).toEqual([...networkKinds].sort());
    }
  });
});

describe("the layouts", () => {
  //        internet
  //           |
  //          box
  //        /     \
  //     host      nas
  //    /    \
  //  web    app
  const nodes = [
    node("internet"),
    node("box", "internet"),
    node("host", "box"),
    node("web", "host"),
    node("app", "host"),
    node("nas", "box"),
  ];

  it("tree: one row per level, each leaf its own column, each parent centred over its children", () => {
    const placed = new Map(layoutTree(nodes).map((p) => [p.node.id, p]));
    expect(placed.get("internet")!.y).toBe(0);
    expect(placed.get("web")!.y).toBe(3);
    expect([placed.get("web")!.x, placed.get("app")!.x, placed.get("nas")!.x]).toEqual([0, 1, 2]);
    expect(placed.get("host")!.x).toBe(0.5);
    expect(placed.get("box")!.x).toBe(1.25);
    expect(placed.get("internet")!.x).toBe(1.25);
  });

  it("tree: keeps the file's order, and never puts two nodes on the same spot", () => {
    const placed = layoutTree(nodes);
    expect(placed.map((p) => p.node.id)).toEqual(nodes.map((n) => n.id));
    const spots = placed.map((p) => `${p.x}:${p.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("list: one node per row, in reading order, indented by depth — a file tree", () => {
    const placed = layoutList(nodes);
    expect(placed.map((p) => p.node.id)).toEqual(["internet", "box", "host", "web", "app", "nas"]);
    expect(placed.map((p) => p.x)).toEqual([0, 1, 2, 3, 3, 2]);
    expect(placed.map((p) => p.y)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("links each node to its parent: one line fewer than nodes", () => {
    expect(networkLinks(nodes)).toHaveLength(nodes.length - 1);
    expect(networkLinks(nodes)).toContainEqual(["host", "web"]);
  });
});
