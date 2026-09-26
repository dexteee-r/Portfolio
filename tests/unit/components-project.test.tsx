import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectBody } from "@/components/ProjectBody";
import { ProjectView } from "@/components/ProjectView";
import type { LocalizedProject } from "@/content/projects";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/dev/alpha-app" }));

const fr = getDictionary("fr");
const en = getDictionary("en");
const SHOT = "/media/fixtures/alpha-shot.png";
const sizes = { [SHOT]: { width: 1200, height: 900 } };

function project(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
  return {
    slug: "alpha-app",
    chapter: "dev",
    status: "published",
    title: "Alpha",
    summary: "Une application de test.",
    lang: "fr",
    body: "## Contexte\n\nDu texte.",
    bodyLang: "fr",
    cover: "/media/fixtures/alpha-cover.webp",
    coverAlt: "Dégradé indigo.",
    year: 2025,
    links: [
      { kind: "site", url: "https://example.com/alpha" },
      { kind: "repo", url: "https://github.com/example/alpha" },
    ],
    ...overrides,
  };
}

describe("ProjectBody", () => {
  const renderBody = (markdown: string) => render(<ProjectBody markdown={markdown} images={sizes} />);

  it("renders sections as h2 — including a heading written as h1, since the page title is the one h1", () => {
    renderBody("## Contexte\n\ntexte\n\n# Écrit en niveau 1");
    expect(screen.getByRole("heading", { level: 2, name: "Contexte" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Écrit en niveau 1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("serves images through the pipeline at their real size", () => {
    renderBody(`Texte ![Capture](${SHOT}) suite.`);
    const img = screen.getByRole("img", { name: "Capture" });
    expect(img.getAttribute("src")).toContain("/_next/image");
    expect(img).toHaveAttribute("width", "1200");
    expect(img).toHaveAttribute("height", "900");
  });

  it("turns an image alone in its paragraph into a figure, with its title as caption", () => {
    const { container } = renderBody(`![Capture](${SHOT} "La légende")`);
    const figure = container.querySelector("figure")!;
    expect(figure).not.toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(within(figure).getByRole("img", { name: "Capture" })).toBeInTheDocument();
    expect(figure.querySelector("figcaption")).toHaveTextContent("La légende");
  });

  it("gives an untitled lone image a figure without a caption", () => {
    const { container } = renderBody(`![Capture](${SHOT})`);
    expect(container.querySelector("figure figcaption")).toBeNull();
  });

  it("keeps site links internal and web links plain", () => {
    renderBody("[chapitre](/fr/dev) et [site](https://example.com)");
    expect(screen.getByRole("link", { name: "chapitre" })).toHaveAttribute("href", "/fr/dev");
    const external = screen.getByRole("link", { name: "site" });
    expect(external).toHaveAttribute("href", "https://example.com");
    expect(external).not.toHaveAttribute("target");
  });

  it("wraps tables so they scroll on their own", () => {
    const { container } = renderBody("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(container.querySelector(".prose-scroll > table")).not.toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("renders code blocks", () => {
    const { container } = renderBody("```ts\nconst a = 1;\n```");
    expect(container.querySelector("pre code")).toHaveTextContent("const a = 1;");
  });

  it("never renders raw HTML nor unsafe links, even if they got past the loader", () => {
    const { container } = renderBody('<script>alert(1)</script>\n\n<b>gras</b> [x](javascript:alert(1)) <img src=x onerror="alert(1)">');
    expect(container.querySelector("script, b, [onerror]")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("drops an image whose size is unknown rather than render it unsized", () => {
    renderBody("![Ailleurs](/media/unknown.png)");
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ProjectView", () => {
  it("is a project view in its chapter's grade", () => {
    const { container } = render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-view", "project");
    expect(root).toHaveAttribute("data-chapter", "dev");
  });

  it("has one h1, focusable for the transition to land on", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    const title = screen.getByRole("heading", { level: 1, name: "Alpha" });
    expect(title).toHaveAttribute("tabindex", "-1");
    expect(title).toHaveAttribute("data-view-title");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("states its chapter and year, and shows the summary", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    expect(screen.getByText("Développement · 2025")).toBeInTheDocument();
    expect(screen.getByText("Une application de test.")).toBeInTheDocument();
  });

  it("shows the path ELMZN / dev / alpha-app, the chapter being a link", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    const trail = screen.getByRole("navigation", { name: fr.topBar.breadcrumbLabel });
    expect(within(trail).getByRole("link", { name: "dev" })).toHaveAttribute("href", "/fr/dev");
    expect(within(trail).getByText("alpha-app").closest("li")).toHaveAttribute("aria-current", "page");
  });

  it("names its links in the page's language", () => {
    render(<ProjectView locale="en" dict={en} project={project()} images={sizes} />);
    const links = screen.getByRole("list", { name: "Project links" });
    expect(within(links).getByRole("link", { name: /Visit the site/ })).toHaveAttribute("href", "https://example.com/alpha");
    expect(within(links).getByRole("link", { name: /Source code/ })).toHaveAttribute(
      "href",
      "https://github.com/example/alpha",
    );
  });

  it("shows the cover, described", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    expect(screen.getByRole("img", { name: "Dégradé indigo." })).toHaveAttribute("loading", "eager");
  });

  it("stays whole without a cover, a body, links or a year", () => {
    render(
      <ProjectView
        locale="fr"
        dict={fr}
        project={project({ cover: undefined, body: "", links: [], year: undefined })}
        images={{}}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("list", { name: "Liens du projet" })).toBeNull();
    expect(screen.getByText("Développement")).toBeInTheDocument();
    expect(document.querySelector(".prose")).toBeNull();
  });

  it("marks French fallbacks inside an English page", () => {
    const { container } = render(
      <ProjectView locale="en" dict={en} project={project({ lang: "fr", bodyLang: "fr" })} images={sizes} />,
    );
    expect(screen.getByRole("heading", { level: 1 }).closest("[lang]")).toHaveAttribute("lang", "fr");
    expect(container.querySelector(".prose")!.closest("[lang]")).toHaveAttribute("lang", "fr");
  });

  it("links to the previous and next projects of the chapter", () => {
    render(
      <ProjectView
        locale="fr"
        dict={fr}
        project={project()}
        images={sizes}
        previous={{ href: "/fr/dev/zero", title: "Zéro", lang: "fr" }}
        next={{ href: "/fr/dev/beta-tool", title: "Bêta", lang: "fr" }}
      />,
    );
    const siblings = screen.getByRole("navigation", { name: "Autres projets du chapitre" });
    expect(within(siblings).getByRole("link", { name: /Projet précédent\s*Zéro/ })).toHaveAttribute("rel", "prev");
    expect(within(siblings).getByRole("link", { name: /Projet suivant\s*Bêta/ })).toHaveAttribute("href", "/fr/dev/beta-tool");
  });

  it("has no sibling navigation for a project alone in its chapter", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    expect(screen.queryByRole("navigation", { name: "Autres projets du chapitre" })).toBeNull();
  });

  it("offers the way back to its chapter at the end", () => {
    render(<ProjectView locale="fr" dict={fr} project={project()} images={sizes} />);
    const back = within(screen.getByRole("contentinfo")).getByRole("link", { name: "Retour au chapitre" });
    expect(back).toHaveAttribute("href", "/fr/dev");
  });
});
