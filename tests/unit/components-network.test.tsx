import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChapterView } from "@/components/ChapterView";
import { NetworkMap } from "@/components/NetworkMap";
import type { NetworkNode } from "@/content/network-layout";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/homelab" }));

const fr = getDictionary("fr");
const en = getDictionary("en");

const nodes: NetworkNode[] = [
  { id: "internet", label: "Internet", kind: "internet" },
  { id: "box", label: "Box", kind: "router", parent: "internet" },
  { id: "srv1", label: "srv1", kind: "hypervisor", parent: "box" },
  { id: "web", label: "lxc-web", kind: "container", parent: "srv1" },
  { id: "grafana", label: "Grafana", kind: "service", parent: "srv1" },
];

/** An IntersectionObserver the test can trigger. */
function observer() {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  return (isIntersecting: boolean) =>
    act(() => callbacks.forEach((cb) => cb([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error — back to jsdom's own: no matchMedia.
  delete window.matchMedia;
});

describe("NetworkMap", () => {
  it("is a figure with a caption, its drawings hidden from screen readers", () => {
    const { container } = render(<NetworkMap dict={fr} nodes={nodes} />);
    const figure = container.querySelector("figure")!;
    expect(within(figure).getByText(fr.network.caption)).toBeInTheDocument();
    const drawings = figure.querySelectorAll("svg");
    expect(drawings).toHaveLength(2); // a tree for wide screens, a list for phones
    for (const svg of drawings) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("gives screen readers the same tree, in words", () => {
    render(<NetworkMap dict={fr} nodes={nodes} />);
    const top = screen.getByText(/^Internet — Internet/).closest("li")!;
    const srv1 = within(top).getByText(/^srv1 — Hyperviseur/).closest("li")!;
    expect(within(srv1).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "lxc-web — Conteneur",
      "Grafana — Service",
    ]);
  });

  it("draws one line per node but the root, in each drawing, traced from its own length", () => {
    const { container } = render(<NetworkMap dict={fr} nodes={nodes} />);
    for (const svg of container.querySelectorAll("svg")) {
      const lines = svg.querySelectorAll(".net-line");
      expect(lines).toHaveLength(nodes.length - 1);
      for (const line of lines) expect(line).toHaveAttribute("pathLength", "1");
    }
  });

  it("stays readable on a wide screen however many machines: past five columns, lists under them", () => {
    // Three machines hosting twelve leaves: a plain tree would be twelve columns wide.
    const wide: NetworkNode[] = [
      { id: "internet", label: "Internet", kind: "internet" },
      { id: "box", label: "Box", kind: "router", parent: "internet" },
      ...["m1", "m2", "m3"].map((id) => ({ id, label: id, kind: "hypervisor" as const, parent: "box" })),
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `s${i}`,
        label: `service-${i}`,
        kind: "container" as const,
        parent: `m${(i % 3) + 1}`,
      })),
    ];
    const { container } = render(<NetworkMap dict={fr} nodes={wide} />);
    const drawing = container.querySelector("svg")!;
    const [, , width] = drawing.getAttribute("viewBox")!.split(" ").map(Number);
    // Three columns, not twelve: the labels keep a readable size at 64rem.
    expect(width).toBeLessThan(1100);
    // A listed node hangs from its machine like a file in a folder: down, then across.
    const paths = [...drawing.querySelectorAll(".net-line")].map((p) => p.getAttribute("d")!);
    expect(paths.filter((d) => /^M[\d.]+ [\d.]+V[\d.]+H[\d.]+$/.test(d))).toHaveLength(12);
  });

  it("holds every node in the chapter's accent brackets, named and typed in the page's language", () => {
    const { container } = render(<NetworkMap dict={en} nodes={nodes} />);
    const tree = container.querySelector("svg")!;
    expect(tree.querySelectorAll(".net-brackets.text-chapter-accent")).toHaveLength(nodes.length);
    expect(tree.textContent).toContain("srv1");
    expect(tree.textContent).toContain("Hypervisor");
  });

  it("paces the drawing level by level", () => {
    const { container } = render(<NetworkMap dict={fr} nodes={nodes} />);
    const delayOf = (label: string) =>
      [...container.querySelector("svg")!.querySelectorAll<SVGGElement>(".net-node")]
        .find((g) => g.textContent?.startsWith(label))!
        .style.getPropertyValue("--delay");
    expect(parseInt(delayOf("Internet"))).toBeLessThan(parseInt(delayOf("Box")));
    expect(parseInt(delayOf("Box"))).toBeLessThan(parseInt(delayOf("srv1")));
    expect(parseInt(delayOf("srv1"))).toBeLessThan(parseInt(delayOf("lxc-web")));
  });

  it("waits, hidden, to be seen — then draws itself", () => {
    const see = observer();
    const { container } = render(<NetworkMap dict={fr} nodes={nodes} />);
    const figure = container.querySelector("figure")!;
    expect(figure).toHaveAttribute("data-armed");
    expect(figure).not.toHaveAttribute("data-drawn");
    see(false);
    expect(figure).not.toHaveAttribute("data-drawn");
    see(true);
    expect(figure).toHaveAttribute("data-drawn");
  });

  it("is simply drawn under reduced motion, or where nothing can tell when it is seen", () => {
    observer();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query.includes("reduce") }),
    });
    const reduced = render(<NetworkMap dict={fr} nodes={nodes} />);
    expect(reduced.container.querySelector("figure")).not.toHaveAttribute("data-armed");
    reduced.unmount();

    vi.unstubAllGlobals(); // no IntersectionObserver at all
    // @ts-expect-error — jsdom again
    delete window.matchMedia;
    const plain = render(<NetworkMap dict={fr} nodes={nodes} />);
    expect(plain.container.querySelector("figure")).not.toHaveAttribute("data-armed");
  });
});

describe("ChapterView and the network", () => {
  it("draws the homelab in the infra chapter, between its title and its drawer", () => {
    const { container } = render(
      <ChapterView locale="fr" dict={fr} chapter="infra" stations={[]} publishedCount={0} network={nodes} />,
    );
    const figure = container.querySelector("[data-network]")!;
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws nothing without a network, and never in another chapter", () => {
    const none = render(<ChapterView locale="fr" dict={fr} chapter="infra" stations={[]} publishedCount={0} />);
    expect(none.container.querySelector("[data-network]")).toBeNull();
    none.unmount();
    const dev = render(<ChapterView locale="fr" dict={fr} chapter="dev" stations={[]} publishedCount={0} network={nodes} />);
    expect(dev.container.querySelector("[data-network]")).toBeNull();
  });
});
