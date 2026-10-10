import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChapterView } from "@/components/ChapterView";
import { reelProjects, RepairWorld, toReelItem } from "@/components/repair/RepairWorld";
import { tiltOf, TILTS } from "@/components/repair/WorkOrder";
import type { LocalizedProject } from "@/content/projects";
import { getDictionary } from "@/i18n/dictionaries";
import { cssColour, easeOutCubic } from "@/lib/webgl";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/repair" }));
// The WebGL layers load lazily in the browser; here, only where they sit matters.
vi.mock("next/dynamic", () => ({
  default: () =>
    function Effect() {
      return <span data-effect="" />;
    },
}));

const fr = getDictionary("fr");
const en = getDictionary("en");

function repair(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
  return {
    slug: "iphone-ecran",
    chapter: "repair",
    status: "published",
    title: "iPhone — écran",
    summary: "Un écran neuf.",
    lang: "fr",
    body: "",
    bodyLang: "fr",
    cover: "/media/fixtures/alpha-shot.png",
    coverAlt: "Un iPhone à l'écran fêlé.",
    links: [],
    stack: [],
    device: "iPhone 16 Pro Max",
    duration: 150,
    year: 2026,
    role: "Remplacement de l'écran",
    roleLang: "fr",
    scan: [{ label: "Écran", x: 10, y: 20, w: 40, h: 50 }],
    scanLang: "fr",
    ...overrides,
  };
}

const stations = [
  repair(),
  repair({ slug: "pc-montage", title: "PC — montage", device: "PC Ryzen", scan: [], duration: undefined }),
];
const size = { width: 300, height: 400 };
const reel = (locale: "fr" | "en" = "fr") => stations.map((p) => toReelItem(p, locale, size));

describe("the repair chapter: the workbench", () => {
  it("is its own world inside the chapter's grade, with one focusable h1", () => {
    const { container } = render(
      <ChapterView locale="fr" dict={fr} chapter="repair" stations={stations} publishedCount={2} />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-chapter", "repair");
    expect(container.querySelector('[data-world="repair"]')).not.toBeNull();
    const title = screen.getByRole("heading", { level: 1, name: "Réparation/Montage" });
    expect(title).toHaveAttribute("tabindex", "-1");
    expect(title).toHaveAttribute("data-view-title");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(fr.chapters.repair.description)).toBeInTheDocument();
    expect(screen.getByText("2 projets")).toBeInTheDocument();
  });

  it("pins every intervention to the board as a work order, each a link to its page", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    const items = within(screen.getByRole("list", { name: "Projets" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("link", { name: "iPhone — écran" })).toHaveAttribute(
      "href",
      "/fr/repair/iphone-ecran",
    );
    expect(within(items[1]!).getByRole("link", { name: "PC — montage" })).toHaveAttribute(
      "href",
      "/fr/repair/pc-montage",
    );
  });

  it("prints each order's facts in words: the device, what was done, how long, when", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    const first = within(screen.getByRole("list", { name: "Projets" })).getAllByRole("listitem")[0]!;
    expect(within(first).getByText("iPhone 16 Pro Max")).toBeInTheDocument();
    expect(within(first).getByText("Remplacement de l'écran")).toBeInTheDocument();
    const time = first.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "PT2H30M");
    expect(within(first).getByText("2026")).toBeInTheDocument();
    expect(within(first).getByText("Un écran neuf.")).toBeInTheDocument();
  });

  it("leaves a missing fact out, never an empty line", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    const second = within(screen.getByRole("list", { name: "Projets" })).getAllByRole("listitem")[1]!;
    expect(second.querySelector("time")).toBeNull();
    expect(within(second).queryByText(fr.projectPage.ticket.duration)).toBeNull();
  });

  it("hangs each order a little askew, never twice the same way in a row", () => {
    const { container } = render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    const tilts = [...container.querySelectorAll<HTMLElement>("[data-station]")].map((o) => o.style.getPropertyValue("--tilt"));
    expect(tilts).toEqual([`${TILTS[0]}deg`, `${TILTS[1]}deg`]);
    for (let i = 1; i < 12; i += 1) expect(tiltOf(i)).not.toBe(tiltOf(i - 1));
  });

  it("has no drawer: the board is the chapter's index", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    expect(screen.queryByRole("navigation", { name: fr.chapterPage.drawerLabel })).toBeNull();
  });

  it("opens on a reel of diagnostics: the first repair shown, its parts named, a link to it", () => {
    const { container } = render(
      <RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} reel={reel()} />,
    );
    const figure = container.querySelector("[data-reel]")!;
    const items = [...figure.querySelectorAll("[data-item]")];
    expect(items).toHaveLength(2);
    // Only the repair on screen is read out: the others wait, hidden from screen readers.
    expect(items[0]).toHaveAttribute("data-current");
    expect(items[0]).not.toHaveAttribute("aria-hidden");
    expect(items[1]).toHaveAttribute("aria-hidden", "true");
    expect(within(items[0] as HTMLElement).getByRole("img", { name: "Un iPhone à l'écran fêlé." })).toBeInTheDocument();
    // The first repair names one part; the second none.
    expect(items[0]!.querySelectorAll("[data-reel-mark]")).toHaveLength(1);
    expect(items[1]!.querySelectorAll("[data-reel-mark]")).toHaveLength(0);
    // The X-ray lies over the photos.
    expect(figure.querySelector("[data-effect]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Voir l'intervention : iPhone 16 Pro Max →" })).toHaveAttribute(
      "href",
      "/fr/repair/iphone-ecran",
    );
    expect(figure.querySelector("[data-reel-count]")).toHaveTextContent("01 / 02");
    // The stamp is decoration.
    expect(container.querySelector(".workbench-stamp")).toHaveAttribute("aria-hidden", "true");
  });

  it("can be paused: moving content that does not stop by itself", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} reel={reel()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Relancer" })).toBeInTheDocument();
  });

  it("has no pause button with a single repair: nothing moves on", () => {
    render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} reel={reel().slice(0, 1)} />);
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("says it in English on the English page", () => {
    render(<RepairWorld locale="en" dict={en} stations={stations} publishedCount={2} reel={reel("en")} />);
    expect(screen.getByRole("heading", { level: 1, name: "Repair/Build" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the repair: iPhone 16 Pro Max →" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("without a repair photo, opens on the board alone — no reel, no stamp", () => {
    const { container } = render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    expect(container.querySelector("[data-reel]")).toBeNull();
    expect(container.querySelector(".workbench-stamp")).toBeNull();
  });

  it("lights the board from behind the text: the lamp's layer is in the opening, decorative", () => {
    const { container } = render(<RepairWorld locale="fr" dict={fr} stations={stations} publishedCount={2} />);
    const bench = container.querySelector(".workbench")!;
    expect(bench.querySelector("[data-effect]")).not.toBeNull();
  });

  it("marks an order in French on the English page", () => {
    const { container } = render(
      <RepairWorld locale="en" dict={en} stations={[repair({ lang: "fr" })]} publishedCount={1} />,
    );
    expect(container.querySelector("[data-station]")).toHaveAttribute("lang", "fr");
  });
});

describe("the opening reel", () => {
  it("shows every repair that has a photo, in the board's order — named parts or not", () => {
    const plain = repair({ slug: "a", scan: [] });
    const noCover = repair({ slug: "b", cover: undefined });
    const scanned = repair({ slug: "c" });
    expect(reelProjects([plain, noCover, scanned]).map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("names a repair by its device, else its title, and links to it in the page's language", () => {
    const item = toReelItem(repair(), "en", size);
    expect(item.name).toBe("iPhone 16 Pro Max");
    expect(item.href).toBe("/en/repair/iphone-ecran");
    expect(item.lang).toBe("fr");
    expect(toReelItem(repair({ device: undefined }), "fr", size).name).toBe("iPhone — écran");
  });
});

describe("the WebGL toolkit", () => {
  it("reads a computed colour's channels, whatever its notation", () => {
    expect(cssColour("rgb(240, 232, 226)")).toEqual([240 / 255, 232 / 255, 226 / 255]);
    expect(cssColour("color(srgb 1 0.5 0)")).toEqual([1, 0.5, 0]);
    expect(cssColour("color(srgb .25 .5 .75)")).toEqual([0.25, 0.5, 0.75]);
    expect(cssColour("")).toEqual([0, 0, 0]);
  });

  it("eases out within 0–1, clamped", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
