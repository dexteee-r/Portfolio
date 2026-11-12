import { act, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChapterView } from "@/components/ChapterView";
import { BOOT_ROWS, BOOT_STEP_MS, BootLog, bootFrame } from "@/components/homelab/BootLog";
import { bootLines, HomelabWorld } from "@/components/homelab/HomelabWorld";
import { machinesOf, rackSlots, UNITS } from "@/components/homelab/MachineUnit";
import type { HomelabNode } from "@/content/network-layout";
import type { LocalizedProject } from "@/content/projects";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/homelab" }));

const fr = getDictionary("fr");
const en = getDictionary("en");

const nodes: HomelabNode[] = [
  { id: "internet", label: "Internet", kind: "internet" },
  { id: "box", label: "Box", kind: "router", parent: "internet" },
  {
    id: "host",
    label: "host-fixture",
    kind: "hypervisor",
    parent: "box",
    form: "mini-pc",
    hardware: "mini-PC de test",
    zone: "zone de test, ouverte",
    project: { href: "/fr/homelab/homelab-fixture", title: "Homelab" },
  },
  { id: "proxy", label: "Proxy fixture", kind: "proxy", parent: "host" },
  {
    id: "site",
    label: "site-fixture",
    kind: "container",
    parent: "host",
    project: { href: "/fr/dev/alpha-app", title: "Alpha", lang: "en" },
  },
  { id: "app", label: "app-fixture", kind: "service", parent: "site" },
  { id: "store", label: "store-fixture", kind: "server", parent: "box", form: "box" },
];

function project(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
  return {
    slug: "machines",
    chapter: "infra",
    status: "published",
    title: "Homelab elmzn.be",
    summary: "Trois machines à la maison.",
    lang: "fr",
    body: "",
    bodyLang: "fr",
    coverAlt: "",
    links: [],
    stack: [],
    year: 2025,
    role: "Conception et exploitation",
    roleLang: "fr",
    scan: [],
    scanLang: "fr",
    ...overrides,
  };
}

const stations = [project(), project({ slug: "acces-distant", title: "Accès distant / VPN", year: 2026, status: "draft" })];

const world = (props: Partial<Parameters<typeof HomelabWorld>[0]> = {}) =>
  render(<HomelabWorld locale="fr" dict={fr} stations={stations} publishedCount={2} network={nodes} {...props} />);

const machines = () => within(screen.getByRole("list", { name: "Machines" })).getAllByRole("article");

afterEach(() => {
  // @ts-expect-error — back to jsdom's own: no matchMedia.
  delete window.matchMedia;
});

describe("the homelab chapter: a phosphor console over its machines", () => {
  it("is its own world inside the chapter's grade, with one focusable h1", () => {
    const { container } = render(
      <ChapterView locale="fr" dict={fr} chapter="infra" stations={stations} publishedCount={2} network={nodes} />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-chapter", "infra");
    expect(container.querySelector('[data-world="infra"]')).not.toBeNull();
    const titles = screen.getAllByRole("heading", { level: 1 });
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent("Homelab");
    expect(titles[0]).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("2 projets")).toBeInTheDocument();
    // The machines and the folders replace the drawer and the stroll.
    expect(screen.queryByRole("navigation", { name: fr.chapterPage.drawerLabel })).toBeNull();
  });

  it("never shows the machines in another chapter", () => {
    const { container } = render(
      <ChapterView locale="fr" dict={fr} chapter="dev" stations={[]} publishedCount={0} network={nodes} />,
    );
    expect(container.querySelector("[data-machine]")).toBeNull();
  });

  it("without a network, keeps its title and its folders — no boot log, no machines", () => {
    const { container } = world({ network: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Homelab");
    expect(container.querySelector("[data-boot-log]")).toBeNull();
    expect(container.querySelector("[data-machine]")).toBeNull();
    expect(within(screen.getByRole("navigation", { name: fr.homelabWorld.folders })).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("the machines", () => {
  it("racks every node with a silhouette, each a heading with what it is and where it stands", () => {
    world();
    const [host, store] = machines();
    expect(machines()).toHaveLength(2);
    expect(within(host!).getByRole("heading", { level: 2 })).toHaveTextContent("host-fixture");
    expect(host).toHaveTextContent("zone de test, ouverte");
    expect(host).toHaveTextContent("mini-PC de test");
    expect(within(host!).getByRole("link", { name: "→ Homelab" })).toHaveAttribute("href", "/fr/homelab/homelab-fixture");
    expect(within(store!).getByRole("heading", { level: 2 })).toHaveTextContent("store-fixture");
    expect(screen.getByText("Baie 01 · 2 machines en service")).toBeInTheDocument();
    expect(machinesOf(nodes).map((n) => n.id)).toEqual(["host", "store"]);
  });

  it("lists what each machine runs, a VM's own inside it, each linked to its folder", () => {
    world();
    const [host] = machines();
    const services = [...host!.querySelectorAll("[data-service]")].map((s) => s.getAttribute("data-service"));
    expect(services).toEqual(["proxy", "site", "app"]);
    // app-fixture runs on site-fixture: nested in its tray.
    expect(host!.querySelector('[data-service="site"] [data-service="app"]')).not.toBeNull();
    const site = host!.querySelector<HTMLElement>('[data-service="site"]')!;
    expect(within(site).getByRole("link", { name: "→ Alpha" })).toHaveAttribute("lang", "en");
    expect(site).toHaveTextContent("Conteneur");
  });

  it("says so when a machine runs nothing listed", () => {
    world();
    expect(machines()[1]).toHaveTextContent(fr.homelabWorld.noServices);
  });

  it("counts rack units by silhouette, from U01: a mini PC two, a tower four, a plain box two", () => {
    expect(rackSlots(machinesOf(nodes))).toEqual([1, 1 + UNITS["mini-pc"]]);
    expect(
      rackSlots([
        { id: "t", label: "t", kind: "hypervisor", form: "tower" },
        { id: "b", label: "b", kind: "server", form: "box" },
      ]),
    ).toEqual([1, 5]);
    world();
    expect(machines()[0]).toHaveTextContent("U01 · 2U");
    expect(machines()[1]).toHaveTextContent("U03 · 2U");
  });

  it("draws each machine's silhouette for the phone's shelf, hidden from screen readers", () => {
    const { container } = world();
    const figures = [...container.querySelectorAll(".machine-figure")];
    expect(figures.map((f) => f.getAttribute("data-form"))).toEqual(["mini-pc", "box"]);
    for (const figure of figures) expect(figure).toHaveAttribute("aria-hidden", "true");
  });

  it("speaks the page's language", () => {
    render(<HomelabWorld locale="en" dict={en} stations={stations} publishedCount={2} network={nodes} />);
    expect(screen.getByText("Rack 01 · 2 machines in service")).toBeInTheDocument();
    expect(machines()[0]).toHaveTextContent("Container");
    expect(machines()[1]).toHaveTextContent(en.homelabWorld.noServices);
  });
});

describe("the chapter's folders", () => {
  it("lists every project, each a link, a draft marked", () => {
    world();
    const folders = within(screen.getByRole("navigation", { name: fr.homelabWorld.folders })).getAllByRole("listitem");
    expect(folders).toHaveLength(2);
    expect(within(folders[0]!).getByRole("link", { name: "Homelab elmzn.be" })).toHaveAttribute("href", "/fr/homelab/machines");
    expect(folders[0]).toHaveTextContent("2025");
    expect(within(folders[1]!).getByText(fr.chapterPage.draft)).toBeInTheDocument();
    expect(within(folders[0]!).queryByText(fr.chapterPage.draft)).toBeNull();
  });

  it("is empty-handed without projects", () => {
    world({ stations: [] });
    expect(screen.getByText(fr.chapterPage.empty)).toBeInTheDocument();
  });
});

describe("the boot log", () => {
  const lines = bootLines(fr, nodes);

  it("brings the homelab up one node at a time, in the page's language", () => {
    expect(lines[0]).toBe(fr.homelabWorld.boot);
    expect(lines).toHaveLength(nodes.length + 1);
    expect(lines[3]).toMatch(/^host-fixture\.+ hyperviseur$/);
  });

  it("keeps the last rows on screen, each stamped with its time", () => {
    const frame = bootFrame(lines, lines.length).split("\n");
    expect(frame).toHaveLength(Math.min(BOOT_ROWS, lines.length));
    expect(frame[0]).toBe(`[  0.000] ${fr.homelabWorld.boot}`);
    expect(bootFrame(lines, 0)).toBe("");
    const long = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    expect(bootFrame(long, 20).split("\n")).toHaveLength(BOOT_ROWS);
    expect(bootFrame(long, 20).split("\n").at(-1)).toBe("[  0.589] line 19");
  });

  it("is printed in full in the HTML, hidden from screen readers — then replayed once the script is here", () => {
    const html = renderToStaticMarkup(<BootLog lines={lines} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("store-fixture");
    vi.useFakeTimers();
    const { container } = render(<BootLog lines={lines} />);
    const log = container.querySelector("[data-boot-log]")!;
    act(() => vi.advanceTimersByTime(BOOT_STEP_MS));
    expect(log.textContent).toBe(`[  0.000] ${fr.homelabWorld.boot}`);
    act(() => vi.advanceTimersByTime(BOOT_STEP_MS * lines.length));
    expect(log.textContent).toBe(bootFrame(lines, lines.length));
    vi.useRealTimers();
  });

  it("stays printed under reduced motion", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query.includes("reduce") }),
    });
    const { container } = render(<BootLog lines={lines} />);
    act(() => vi.advanceTimersByTime(10));
    expect(container.querySelector("[data-boot-log]")!.textContent).toBe(bootFrame(lines, lines.length));
    vi.useRealTimers();
  });
});
