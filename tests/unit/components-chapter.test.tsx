import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChapterView } from "@/components/ChapterView";
import { Station } from "@/components/Station";
import type { LocalizedProject } from "@/content/projects";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/dev" }));

const fr = getDictionary("fr");
const en = getDictionary("en");

function project(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
  return {
    slug: "alpha-app",
    chapter: "dev",
    status: "published",
    title: "Alpha",
    summary: "Une application de test.",
    lang: "fr",
    body: "",
    bodyLang: "fr",
    cover: "/media/fixtures/alpha-cover.webp",
    coverAlt: "Dégradé indigo.",
    links: [],
    ...overrides,
  };
}

describe("ChapterView", () => {
  const stations = [project(), project({ slug: "beta-tool", title: "Bêta", cover: undefined, coverAlt: "" })];

  it("is a chapter view in its own grade", () => {
    const { container } = render(
      <ChapterView locale="fr" dict={fr} chapter="dev" stations={stations} publishedCount={2} />,
    );
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-view", "chapter");
    expect(root).toHaveAttribute("data-chapter", "dev");
  });

  it("has a focusable title for the drawer to land on, and one h1 only", () => {
    render(<ChapterView locale="fr" dict={fr} chapter="dev" stations={stations} publishedCount={2} />);
    const title = screen.getByRole("heading", { level: 1, name: "Développement" });
    expect(title).toHaveAttribute("tabindex", "-1");
    expect(title).toHaveAttribute("data-view-title");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("describes the chapter and states its real count", () => {
    render(<ChapterView locale="fr" dict={fr} chapter="dev" stations={stations} publishedCount={2} />);
    expect(screen.getByText(fr.chapters.dev.description)).toBeInTheDocument();
    expect(screen.getByText("2 projets")).toBeInTheDocument();
  });

  it("lists stations in order, each a link to its project page", () => {
    render(<ChapterView locale="fr" dict={fr} chapter="dev" stations={stations} publishedCount={2} />);
    const list = screen.getByRole("list", { name: "Projets" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/fr/dev/alpha-app");
    expect(within(items[1]!).getByRole("link", { name: "Bêta" })).toHaveAttribute("href", "/fr/dev/beta-tool");
  });

  it("says so plainly when a chapter is still empty", () => {
    render(<ChapterView locale="fr" dict={fr} chapter="repair" stations={[]} publishedCount={0} />);
    expect(screen.getByText("Ce dossier est encore vide.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Projets" })).toBeNull();
    expect(screen.getByText("0 projet")).toBeInTheDocument();
  });

  it("shows its path in the top bar, with ELMZN leading back to the desk", () => {
    render(<ChapterView locale="en" dict={en} chapter="creative" stations={[]} publishedCount={0} />);
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: en.topBar.homeLabel })).toHaveAttribute("href", "/en");
    expect(within(trail).getByText("creative").closest("li")).toHaveAttribute("aria-current", "page");
  });

  it("offers a way back to the desk at the end", () => {
    render(<ChapterView locale="fr" dict={fr} chapter="dev" stations={stations} publishedCount={2} />);
    const back = within(screen.getByRole("contentinfo")).getByRole("link", { name: "Retour au bureau" });
    expect(back).toHaveAttribute("href", "/fr");
  });
});

describe("Station", () => {
  it("shows the cover with its description", () => {
    render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    expect(screen.getByRole("img", { name: "Dégradé indigo." })).toBeInTheDocument();
  });

  it("loads the first cover eagerly and the others lazily", () => {
    const { container: first } = render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    const { container: later } = render(<Station locale="fr" dict={fr} project={project()} index={2} />);
    expect(first.querySelector("img")).toHaveAttribute("loading", "eager");
    expect(later.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("falls back to the project's folder when there is no image, hidden from screen readers", () => {
    const { container } = render(
      <Station locale="fr" dict={fr} project={project({ cover: undefined })} index={0} />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    const placeholder = container.querySelector('[aria-hidden="true"]')!;
    expect(placeholder).toHaveTextContent("alpha-app/");
  });

  it("numbers stations from 01", () => {
    render(<Station locale="fr" dict={fr} project={project()} index={2} />);
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("has a single link, named after the project — the call to action is decorative", () => {
    render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText(/Ouvrir le dossier/)).toHaveAttribute("aria-hidden", "true");
  });

  it("marks a French fallback inside an English page with lang=fr", () => {
    const { container } = render(<Station locale="en" dict={en} project={project({ lang: "fr" })} index={0} />);
    expect(container.querySelector("article")).toHaveAttribute("lang", "fr");
  });

  it("carries no lang attribute when the card is in the page's language", () => {
    const { container } = render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    expect(container.querySelector("article")).not.toHaveAttribute("lang");
  });

  it("flags drafts, which only exist outside production", () => {
    render(<Station locale="fr" dict={fr} project={project({ status: "draft" })} index={0} />);
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
  });

  it("alternates image and text sides from one station to the next", () => {
    const { container: even } = render(<Station locale="fr" dict={fr} project={project()} index={0} />);
    const { container: odd } = render(<Station locale="fr" dict={fr} project={project()} index={1} />);
    expect(even.querySelector("article > div")!.className).not.toContain("md:order-2");
    expect(odd.querySelector("article > div")!.className).toContain("md:order-2");
  });
});
