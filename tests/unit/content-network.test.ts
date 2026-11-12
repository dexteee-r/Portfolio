import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { ContentError } from "@/content/projects";
import { loadNetwork, localizeNetwork, NETWORK_FILE, NETWORK_MAX_NODES, parseNetwork } from "@/content/network";
import { networkKinds, type NetworkNode } from "@/content/network-layout";
import { loadProjects, localizeProject, visibleProjects } from "@/content/projects";
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

  it("draws only what runs today: nothing stopped, unused or still being set up", () => {
    const labels = parseNetwork(readFileSync(join(ROOT, "content", NETWORK_FILE), "utf8")).nodes.map((n) => n.label);
    const unfinished = /grafana|prometheus|checkmk|vaultwarden|home assistant|pi-hole|poste\.io|n8n|ollama/i;
    for (const label of labels) expect(label, label).not.toMatch(unfinished);
  });

  it("names every kind in every language", () => {
    for (const locale of locales) {
      expect(Object.keys(getDictionary(locale).network.kinds).sort()).toEqual([...networkKinds].sort());
    }
  });
});

describe("what a machine says about itself", () => {
  const machine = (extra: Record<string, unknown>) => [node("internet"), { ...node("host", "internet"), ...extra }];

  it("reads a silhouette, its hardware and zone in every language, and a project", () => {
    const [, host] = parseNetwork(
      yaml(
        machine({
          form: "mini-pc",
          hardware: { fr: "mini-PC", en: "mini PC" },
          zone: { fr: "ouverte", en: "open" },
          project: "machines",
        }),
      ),
    ).nodes;
    expect(host).toMatchObject({ form: "mini-pc", hardware: { fr: "mini-PC", en: "mini PC" }, project: "machines" });
  });

  it("asks every language, refuses an address there too, a made-up silhouette, and the radar's old fields", () => {
    fails(machine({ hardware: { fr: "mini-PC" } }), /en/);
    fails(machine({ zone: { fr: "DMZ 192.168.1.0", en: "DMZ" } }), /address or a port/);
    fails(machine({ zone: { fr: "x".repeat(61), en: "x" } }), /zone/);
    fails(machine({ project: "Not A Slug" }), /project/);
    fails(machine({ form: "rack-server" }), /form/);
    fails(machine({ sector: "DMZ" }), /sector/);
    fails(machine({ featured: true }), /featured/);
  });

  it("speaks the page's language, and links only a project the page shows", () => {
    const nodes = parseNetwork(
      yaml([
        node("internet"),
        { ...node("host", "internet"), hardware: { fr: "tour", en: "tower" }, zone: { fr: "fermée", en: "closed" }, project: "shown" },
        { ...node("app", "host"), project: "hidden" },
      ]),
    ).nodes;
    const shown = { slug: "shown", chapter: "infra", title: "Montré", lang: "fr" } as never;
    const [, host, app] = localizeNetwork(nodes, "en", [shown]);
    expect(host).toMatchObject({ hardware: "tower", zone: "closed", project: { href: "/en/homelab/shown", title: "Montré", lang: "fr" } });
    expect(app!.project).toBeUndefined();
    expect(localizeNetwork(nodes, "fr", [shown])[1]!.project).toEqual({ href: "/fr/homelab/shown", title: "Montré" });
  });

  it("in the real homelab: its three machines, every project it names real, nothing the Machines project does not say", () => {
    const network = loadNetwork(join(ROOT, "content"), true)!;
    const machines = network.filter((n) => n.form);
    expect(machines.map((m) => m.label)).toEqual(["Extranet · DMZ", "Intranet", "ZimaOS"]);
    expect(machines.map((m) => m.form)).toEqual(["mini-pc", "tower", "box"]);
    // The third is a server that keeps files, not a NAS (its owner, 2026-11-13).
    expect(machines.map((m) => m.kind)).toEqual(["hypervisor", "hypervisor", "server"]);
    expect(network.filter((n) => n.parent === "zimaos").map((n) => n.label)).toEqual(["Partage de fichiers"]);
    const slugs = loadProjects(join(ROOT, "content")).map((p) => p.slug);
    for (const n of network.filter((n) => n.project)) expect(slugs, n.id).toContain(n.project);
    // The hardware's model names and figures are already published on the « Machines » project.
    const published = readFileSync(join(ROOT, "content", "projects", "machines.yaml"), "utf8");
    for (const m of machines) {
      for (const locale of locales) {
        for (const word of (m.hardware?.[locale] ?? "").split(/\s+/).filter((w) => /\d/.test(w))) {
          expect(published, `${m.id}: ${word}`).toContain(word);
        }
      }
    }
  });

  it("links the fixture's machine and site to their projects, and its draft to nothing in production", () => {
    const projects = visibleProjects(loadProjects(FIXTURES), false).map((p) => localizeProject(p, "fr"));
    const byId = new Map(localizeNetwork(loadNetwork(FIXTURES, false)!, "fr", projects).map((n) => [n.id, n]));
    expect(byId.get("host")!.project?.href).toBe("/fr/homelab/homelab-fixture");
    expect(byId.get("site")!.project?.href).toBe("/fr/dev/alpha-app");
    expect(byId.get("store")!.project).toBeUndefined();
  });
});
