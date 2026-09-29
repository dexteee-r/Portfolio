import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { barcode, Floppy } from "@/components/Floppy";
import { ProjectBody } from "@/components/ProjectBody";
import { ProjectView } from "@/components/ProjectView";
import { SpecSheet } from "@/components/SpecSheet";
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
    stack: ["Next.js", "PostgreSQL"],
    role: "Conception et développement",
    roleLang: "fr",
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

describe("Floppy", () => {
  const renderFloppy = (props: Partial<Parameters<typeof Floppy>[0]> = {}) =>
    render(<Floppy brand="ELMZN" title="Alpha" slug="alpha-app" year={2025} disk={{ number: 1, total: 4 }} {...props} />)
      .container.querySelector<HTMLElement>("[data-floppy]")!;

  it("is decorative: all of it is already on the page, so screen readers skip it", () => {
    const floppy = renderFloppy();
    expect(floppy).toHaveAttribute("aria-hidden", "true");
    expect(floppy.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
  });

  it("labels the disk: brand, title, place in the chapter, year", () => {
    const floppy = renderFloppy();
    expect(floppy).toHaveTextContent("ELMZN");
    expect(floppy).toHaveTextContent("Alpha");
    expect(floppy.querySelector("[data-floppy-disk]")).toHaveTextContent("01/04");
    expect(floppy).toHaveTextContent("2025");
  });

  it("leaves out what it does not know", () => {
    const floppy = renderFloppy({ disk: undefined, year: undefined });
    expect(floppy.querySelector("[data-floppy-disk]")).toBeNull();
    expect(floppy).not.toHaveTextContent(/\d{4}/);
  });

  it("marks a title in the other language", () => {
    const floppy = renderFloppy({ lang: "fr" });
    expect(within(floppy).getByText("Alpha")).toHaveAttribute("lang", "fr");
  });

  it("is drawn in the chapter's colours only, its shutter ready to slide", () => {
    const floppy = renderFloppy();
    const classes = [...floppy.querySelectorAll("svg [class]")].flatMap((el) => [...el.classList]);
    for (const name of classes.filter((c) => /^(fill|stroke)-/.test(c))) {
      expect(name, name).toMatch(/^(fill|stroke)-(chapter-[a-z-]+|current)$/);
    }
    expect(floppy.querySelector("svg .fill-chapter-accent")).not.toBeNull(); // the case, in the chapter's one colour
    expect(floppy.querySelector(".floppy-shutter rect")).toHaveAttribute("mask", "url(#floppy-shutter-window)");
  });
});

describe("barcode", () => {
  it("prints the same code for the same project, a different one for another", () => {
    expect(barcode("alpha-app")).toEqual(barcode("alpha-app"));
    expect(barcode("alpha-app")).not.toEqual(barcode("beta-tool"));
  });

  it("alternates thin bars and gaps, never a block", () => {
    const widths = barcode("mytgc");
    expect(widths).toHaveLength(28);
    widths.forEach((width, index) => {
      expect(width).toBeGreaterThanOrEqual(1);
      expect(width).toBeLessThanOrEqual(index % 2 === 0 ? 3 : 2);
    });
  });
});

describe("SpecSheet", () => {
  const copy = fr.projectPage.specs;

  it("is a titled section of terms and values, readable as text", () => {
    render(<SpecSheet copy={copy} year={2025} role="Conception" stack={["Next.js", "Docker"]} />);
    const sheet = screen.getByRole("region", { name: "Fiche technique" });
    expect(within(sheet).getByRole("heading", { level: 2, name: "Fiche technique" })).toBeInTheDocument();
    const terms = within(sheet).getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["Année", "Rôle", "Stack"]);
    expect(within(sheet).getByText("2025")).toBeInTheDocument();
    expect(within(sheet).getByText("Conception")).toBeInTheDocument();
    expect(within(sheet).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Next.js", "Docker"]);
  });

  it("only has the rows it can fill", () => {
    render(<SpecSheet copy={copy} role="" stack={["Rust"]} />);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Stack"]);
  });

  it("does not exist with nothing to say", () => {
    const { container } = render(<SpecSheet copy={copy} role="" stack={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks a role written in the other language", () => {
    render(<SpecSheet copy={en.projectPage.specs} role="Conception" roleLang="fr" stack={[]} />);
    expect(screen.getByText("Conception")).toHaveAttribute("lang", "fr");
  });
});

describe("ProjectView — the dev chapter's floppy and spec sheet", () => {
  it("heads a dev project with its floppy, then its spec sheet", () => {
    const { container } = render(
      <ProjectView locale="fr" dict={fr} project={project()} images={sizes} disk={{ number: 2, total: 3 }} />,
    );
    const header = container.querySelector("article > header")!;
    const floppy = header.querySelector("[data-floppy]")!;
    expect(floppy.querySelector("[data-floppy-disk]")).toHaveTextContent("02/03");
    const sheet = within(header as HTMLElement).getByRole("region", { name: "Fiche technique" });
    // Reading order: title first, then the sheet; the floppy is decorative.
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(sheet)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("gives the sheet a name in the page's language, and marks a French role on the English page", () => {
    render(<ProjectView locale="en" dict={en} project={project({ roleLang: "fr" })} images={sizes} />);
    const sheet = screen.getByRole("region", { name: "Spec sheet" });
    expect(within(sheet).getByText("Conception et développement")).toHaveAttribute("lang", "fr");
  });

  it("keeps a dev project without data whole: the floppy alone", () => {
    const { container } = render(
      <ProjectView locale="fr" dict={fr} project={project({ year: undefined, role: "", stack: [] })} images={sizes} />,
    );
    expect(container.querySelector("[data-floppy]")).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Fiche technique" })).toBeNull();
  });

  it("is the dev chapter's object only: other chapters wait for their own", () => {
    for (const chapter of ["infra", "repair", "creative"] as const) {
      const { container, unmount } = render(
        <ProjectView locale="fr" dict={fr} project={project({ chapter })} images={sizes} />,
      );
      expect(container.querySelector("[data-floppy]"), chapter).toBeNull();
      expect(container.querySelector("[data-specs]"), chapter).toBeNull();
      unmount();
    }
  });
});
