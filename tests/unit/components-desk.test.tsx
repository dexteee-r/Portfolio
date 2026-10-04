import { act, getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterMarks } from "@/components/ChapterMarks";
import { Clock } from "@/components/Clock";
import { Desk } from "@/components/Desk";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotFoundView } from "@/components/NotFoundView";
import { chapterIds } from "@/content/chapters";
import { getDictionary } from "@/i18n/dictionaries";
import { site } from "@/site";

const pathname = vi.hoisted(() => ({ current: "/fr" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const fr = getDictionary("fr");
const en = getDictionary("en");
const counts = { dev: 4, infra: 1, repair: 0, creative: 2 };

beforeEach(() => {
  pathname.current = "/fr";
});

describe("ChapterMarks", () => {
  it("is a navigation holding a list of four links — not clickable divs", () => {
    render(<ChapterMarks locale="fr" dict={fr} counts={counts} />);
    const nav = screen.getByRole("navigation", { name: "Chapitres" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    for (const item of items) expect(within(item).getByRole("link")).toBeInTheDocument();
  });

  it("names each chapter with its real project count, pluralised per language", () => {
    render(<ChapterMarks locale="fr" dict={fr} counts={counts} />);
    expect(screen.getByRole("link", { name: "Développement 4 projets" })).toHaveAttribute("href", "/fr/dev");
    expect(screen.getByRole("link", { name: "Homelab 1 projet" })).toHaveAttribute("href", "/fr/homelab");
    expect(screen.getByRole("link", { name: "Réparation/Montage 0 projet" })).toHaveAttribute("href", "/fr/repair");
    expect(screen.getByRole("link", { name: "Création 2 projets" })).toHaveAttribute("href", "/fr/creatif");
  });

  it("lets a two-part name wrap after its slash, and only there", () => {
    const { container } = render(<ChapterMarks locale="fr" dict={fr} counts={counts} />);
    const repair = container.querySelector('[data-chapter-mark="repair"]')!;
    expect(repair.querySelectorAll("wbr")).toHaveLength(1);
    expect(repair.querySelector("wbr")!.previousSibling?.textContent).toBe("/");
    expect(container.querySelector('[data-chapter-mark="dev"] wbr')).toBeNull();
  });

  it("uses translated slugs and English plurals in English", () => {
    render(<ChapterMarks locale="en" dict={en} counts={counts} />);
    expect(screen.getByRole("link", { name: "Repair/Build 0 projects" })).toHaveAttribute("href", "/en/repair");
    expect(screen.getByRole("link", { name: "Creative 2 projects" })).toHaveAttribute("href", "/en/creative");
  });

  it("keeps the desk order", () => {
    render(<ChapterMarks locale="fr" dict={fr} counts={counts} />);
    const order = screen.getAllByRole("link").map((a) => a.getAttribute("data-chapter-mark"));
    expect(order).toEqual([...chapterIds]);
  });

  it("colours the folder shape with its mark and never the text", () => {
    const { container } = render(<ChapterMarks locale="fr" dict={fr} counts={counts} />);
    for (const id of chapterIds) {
      const link = container.querySelector(`[data-chapter-mark="${id}"]`)!;
      const svg = link.querySelector("svg")!;
      expect(svg.getAttribute("class")).toContain(`text-mark-${id}`);
      expect(svg).toHaveAttribute("aria-hidden", "true");
      for (const span of link.querySelectorAll("span")) {
        expect(span.className).not.toMatch(/mark-/);
      }
    }
  });
});

describe("LanguageSwitcher", () => {
  it("offers every language, marks the current one, and links to the same page", () => {
    pathname.current = "/fr/creatif/vlog-malaisie";
    render(<LanguageSwitcher locale="fr" label="Langue" />);
    const nav = screen.getByRole("navigation", { name: "Langue" });
    const current = within(nav).getByRole("link", { name: /FR/ });
    const other = within(nav).getByRole("link", { name: /EN/ });

    expect(current).toHaveAttribute("aria-current", "true");
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).toHaveAttribute("href", "/en/creative/vlog-malaisie");
    expect(other).toHaveAttribute("hreflang", "en");
    expect(other).toHaveAttribute("lang", "en");
  });

  it("gives each language its full name for screen readers", () => {
    render(<LanguageSwitcher locale="en" label="Language" />);
    expect(screen.getByRole("link", { name: "FR Français" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EN English" })).toBeInTheDocument();
  });
});

describe("Clock", () => {
  afterEach(() => vi.useRealTimers());

  it("shows Brussels time and keeps ticking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T08:05:00Z"));
    render(<Clock locale="fr" timeZone="Europe/Brussels" label="Heure locale en Belgique" />);
    expect(screen.getByText("10:05").tagName).toBe("TIME");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("10:06")).toBeInTheDocument();
  });

  it("announces what the time is", () => {
    render(<Clock locale="fr" timeZone="Europe/Brussels" label="Heure locale en Belgique" />);
    expect(screen.getByText("Heure locale en Belgique", { exact: false })).toHaveClass("sr-only");
  });
});

describe("Desk", () => {
  it("shows name and identity on first render, with no interaction", () => {
    render(<Desk locale="fr" dict={fr} counts={counts} />);
    expect(screen.getByRole("heading", { level: 1, name: site.ownerName })).toBeInTheDocument();
    // Word for word, its no-break space included.
    const exact = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
    expect(screen.getByText(fr.desk.identity, exact)).toBeInTheDocument();
  });

  it("has ELMZN on the left of the top bar, linking home", () => {
    render(<Desk locale="en" dict={en} counts={counts} />);
    const banner = screen.getByRole("banner");
    const home = within(banner).getByRole("link", { name: en.topBar.homeLabel });
    expect(home).toHaveTextContent(site.brand);
    expect(home).toHaveAttribute("href", "/en");
  });

  it("offers a skip link to the main content as the first focusable element", () => {
    const { container } = render(<Desk locale="fr" dict={fr} counts={counts} />);
    const first = container.querySelector("a, button");
    expect(first).toHaveTextContent(fr.skipLink);
    expect(first).toHaveAttribute("href", "#content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "content");
  });

  it("has exactly one h1", () => {
    render(<Desk locale="fr" dict={fr} counts={counts} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("NotFoundView", () => {
  it("speaks the site's vocabulary and offers the four chapters and the desk", () => {
    render(<NotFoundView locale="fr" dict={fr} counts={counts} />);
    expect(screen.getByRole("heading", { level: 1, name: "Ce dossier n'existe pas." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr.notFound.back })).toHaveAttribute("href", "/fr");
    const chapters = screen.getByRole("navigation", { name: fr.desk.chaptersLabel });
    expect(within(chapters).getAllByRole("link")).toHaveLength(4);
  });
});
