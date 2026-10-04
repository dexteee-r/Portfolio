import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { barcode } from "@/components/Barcode";
import { Floppy } from "@/components/Floppy";
import { ProjectBody } from "@/components/ProjectBody";
import { ProjectView } from "@/components/ProjectView";
import { hasTicket, RepairTicket } from "@/components/RepairTicket";
import { SpecSheet } from "@/components/SpecSheet";
import { VhsJacket } from "@/components/VhsJacket";
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
    scan: [],
    scanLang: "fr",
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

  it("keeps a vertical photo within the screen's height, a wide one at full width", () => {
    const TALL = "/media/fixtures/tall.webp";
    render(<ProjectBody markdown={`![Haute](${TALL}) ![Large](${SHOT})`} images={{ ...sizes, [TALL]: { width: 1000, height: 2000 } }} />);
    expect(screen.getByRole("img", { name: "Haute" }).style.width).toBe("min(100%, 40vh)");
    expect(screen.getByRole("img", { name: "Large" }).style.width).toBe("min(100%, 106.67vh)");
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

  describe("a clip", () => {
    const CLIP = "/media/fixtures/apres.mp4";
    const POSTER = "/media/fixtures/apres.webp";
    const renderClip = (markdown: string) =>
      render(<ProjectBody markdown={markdown} images={{ ...sizes, [POSTER]: { width: 720, height: 1280 } }} />);

    it("plays only when asked: silent, looping, with controls, sized and shown by its poster", () => {
      const { container } = renderClip(`![Le téléphone réparé, l'écran d'accueil qui défile](${CLIP} "Après.")`);
      const video = container.querySelector("video")!;
      expect(video).toHaveAttribute("src", CLIP);
      expect(video).toHaveAttribute("poster", POSTER);
      expect(video).toHaveAttribute("controls");
      expect(video).toHaveAttribute("playsinline");
      expect(video).toHaveAttribute("loop");
      expect(video).toHaveAttribute("preload", "none");
      expect(video).not.toHaveAttribute("autoplay");
      expect(video.muted).toBe(true);
      expect(video).toHaveAttribute("width", "720");
      expect(video).toHaveAttribute("height", "1280");
      expect(video).toHaveAccessibleName("Le téléphone réparé, l'écran d'accueil qui défile");
    });

    it("never stands taller than most of the screen: a vertical clip narrows instead", () => {
      const { container } = renderClip(`![Le téléphone réparé](${CLIP})`);
      // 720 × 1280: at 80 % of the viewport's height, 45vh wide at most.
      expect(container.querySelector("video")!.style.width).toBe("min(100%, 45vh)");
    });

    it("stands as a figure, its title as caption, like a lone image", () => {
      const { container } = renderClip(`![Le téléphone réparé](${CLIP} "Après.")`);
      expect(container.querySelector("figure > video")).not.toBeNull();
      expect(container.querySelector("figure figcaption")).toHaveTextContent("Après.");
      expect(container.querySelector("p")).toBeNull();
    });

    it("is dropped when its poster's size is unknown, rather than shift the page as it loads", () => {
      const { container } = renderBody(`![Le téléphone réparé](${CLIP})`);
      expect(container.querySelector("video")).toBeNull();
    });
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
    render(<SpecSheet copy={copy} locale="fr" year={2025} role="Conception" stack={["Next.js", "Docker"]} />);
    const sheet = screen.getByRole("region", { name: "Fiche technique" });
    expect(within(sheet).getByRole("heading", { level: 2, name: "Fiche technique" })).toBeInTheDocument();
    const terms = within(sheet).getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["Année", "Rôle", "Stack"]);
    expect(within(sheet).getByText("2025")).toBeInTheDocument();
    expect(within(sheet).getByText("Conception")).toBeInTheDocument();
    expect(within(sheet).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Next.js", "Docker"]);
  });

  it("only has the rows it can fill", () => {
    render(<SpecSheet copy={copy} locale="fr" role="" stack={["Rust"]} />);
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Stack"]);
  });

  it("does not exist with nothing to say", () => {
    const { container } = render(<SpecSheet copy={copy} locale="fr" role="" stack={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks a role written in the other language", () => {
    render(<SpecSheet copy={en.projectPage.specs} locale="en" role="Conception" roleLang="fr" stack={[]} />);
    expect(screen.getByText("Conception")).toHaveAttribute("lang", "fr");
  });
});

describe("ProjectView — the dev chapter's floppy and spec sheet", () => {
  it("heads a dev project with its floppy, then its spec sheet", () => {
    const { container } = render(
      <ProjectView locale="fr" dict={fr} project={project()} images={sizes} place={{ number: 2, total: 3 }} />,
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

  it("is the dev chapter's object only: other chapters have their own", () => {
    for (const chapter of ["infra", "repair", "creative"] as const) {
      const { container, unmount } = render(
        <ProjectView locale="fr" dict={fr} project={project({ chapter })} images={sizes} />,
      );
      expect(container.querySelector("[data-floppy]"), chapter).toBeNull();
      unmount();
    }
    for (const chapter of ["repair", "creative"] as const) {
      const { unmount } = render(<ProjectView locale="fr" dict={fr} project={project({ chapter })} images={sizes} />);
      expect(screen.queryByRole("region", { name: "Fiche technique" }), chapter).toBeNull();
      unmount();
    }
  });

  it("gives an infra project its spec sheet under the title — the chapter's effect is its map", () => {
    const { container } = render(
      <ProjectView locale="fr" dict={fr} project={project({ chapter: "infra" })} images={sizes} />,
    );
    const header = container.querySelector("article > header") as HTMLElement;
    expect(header).toHaveClass("max-w-content");
    expect(header).not.toHaveClass("grid");
    const sheet = within(header).getByRole("region", { name: "Fiche technique" });
    expect(within(sheet).getAllByRole("term").map((t) => t.textContent)).toEqual(["Année", "Rôle", "Stack"]);
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(sheet)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container.querySelector("[data-floppy], [data-ticket], [data-vhs]")).toBeNull();
  });
});

describe("RepairTicket", () => {
  const copy = fr.projectPage.ticket;
  const facts = {
    device: "iPhone 16 Pro Max",
    role: "Remplacement de la vitre arrière",
    duration: 150,
    year: 2025,
  };
  const renderTicket = (overrides: Partial<Parameters<typeof RepairTicket>[0]> = {}) =>
    render(<RepairTicket copy={copy} locale="fr" brand="ELMZN" slug="ecran" number={1} {...facts} {...overrides} />);

  it("is a titled section of real text: the device, then what was done, how long, when", () => {
    renderTicket();
    const ticket = screen.getByRole("region", { name: "Fiche d'intervention" });
    expect(within(ticket).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Appareil",
      "Intervention",
      "Durée",
      "Année",
    ]);
    expect(within(ticket).getByText("iPhone 16 Pro Max")).toHaveClass("font-ui", "text-chapter-accent", "text-2xl");
    expect(within(ticket).getByText("Remplacement de la vitre arrière")).toBeInTheDocument();
    expect(within(ticket).getByText("2025")).toBeInTheDocument();
  });

  it("writes the time as a workshop would, and as a machine can read it", () => {
    renderTicket();
    const time = screen.getByText("2 h 30");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "PT2H30M");
    render(<RepairTicket copy={en.projectPage.ticket} locale="en" brand="ELMZN" slug="ecran" {...facts} />);
    expect(screen.getByText("2 h 30 min")).toBeInTheDocument();
  });

  it("numbers the ticket by the project's place in the chapter", () => {
    const { container } = renderTicket({ number: 3 });
    expect(container.querySelector("[data-ticket-number]")).toHaveTextContent("N° 03");
  });

  it("only prints the facts it has", () => {
    renderTicket({ device: undefined, duration: undefined, number: undefined });
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Intervention", "Année"]);
    expect(document.querySelector("[data-ticket-number]")).toBeNull();
  });

  it("does not exist with nothing to print", () => {
    const { container } = renderTicket({ device: undefined, role: "", duration: undefined, year: undefined });
    expect(container).toBeEmptyDOMElement();
    expect(hasTicket({ role: "" })).toBe(false);
    expect(hasTicket({ role: "", year: 2025 })).toBe(true);
  });

  it("marks an intervention written in the other language", () => {
    render(<RepairTicket copy={en.projectPage.ticket} locale="en" brand="ELMZN" slug="ecran" roleLang="fr" {...facts} />);
    expect(screen.getByText("Remplacement de la vitre arrière")).toHaveAttribute("lang", "fr");
  });

  it("hides only its decoration: the slot, the tear line and the barcode", () => {
    const { container } = renderTicket();
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')];
    expect(hidden).toHaveLength(4); // slot, tear line, footer, and the barcode inside the footer
    for (const element of hidden) expect(element.querySelector("dt, dd, h2")).toBeNull();
    expect(container.querySelector("[data-ticket] .ticket-paper")).not.toBeNull();
  });
});

describe("ProjectView — the repair chapter's ticket", () => {
  const repair = (overrides: Partial<LocalizedProject> = {}) =>
    project({
      chapter: "repair",
      stack: [],
      device: "iPhone 16 Pro Max",
      duration: 150,
      role: "Remplacement de la vitre arrière",
      ...overrides,
    });

  it("heads a repair project with its ticket, after the title in reading order", () => {
    const { container } = render(
      <ProjectView locale="fr" dict={fr} project={repair()} images={sizes} place={{ number: 2, total: 3 }} />,
    );
    const ticket = within(container.querySelector("article > header") as HTMLElement).getByRole("region", {
      name: "Fiche d'intervention",
    });
    expect(ticket.querySelector("[data-ticket-number]")).toHaveTextContent("N° 02");
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(ticket)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container.querySelector("[data-floppy], [data-specs]")).toBeNull();
  });

  it("names the ticket in the page's language", () => {
    render(<ProjectView locale="en" dict={en} project={repair({ roleLang: "fr" })} images={sizes} />);
    const ticket = screen.getByRole("region", { name: "Repair ticket" });
    expect(within(ticket).getByText("Remplacement de la vitre arrière")).toHaveAttribute("lang", "fr");
  });

  it("keeps a repair project with nothing to print plain: no ticket, no empty column", () => {
    const { container } = render(
      <ProjectView
        locale="fr"
        dict={fr}
        project={repair({ device: undefined, duration: undefined, role: "", year: undefined })}
        images={sizes}
      />,
    );
    expect(container.querySelector("[data-ticket]")).toBeNull();
    expect(container.querySelector("article > header")).toHaveClass("max-w-content");
    expect(container.querySelector("article > header")).not.toHaveClass("grid");
  });

  it("is the repair chapter's object only", () => {
    for (const chapter of ["dev", "infra", "creative"] as const) {
      const { container, unmount } = render(
        <ProjectView locale="fr" dict={fr} project={repair({ chapter })} images={sizes} />,
      );
      expect(container.querySelector("[data-ticket]"), chapter).toBeNull();
      unmount();
    }
  });
});

describe("VhsJacket", () => {
  const COVER = "/media/fixtures/film-cover.webp";
  const renderJacket = (props: Partial<Parameters<typeof VhsJacket>[0]> = {}) =>
    render(
      <VhsJacket
        brand="ELMZN"
        label="Création"
        title="Film test"
        locale="fr"
        slug="film-test"
        year={2024}
        duration={12}
        cover={COVER}
        coverSizes="(min-width: 1024px) 64rem, 100vw"
        {...props}
      />,
    ).container.querySelector<HTMLElement>("[data-vhs]")!;

  it("is decorative: all of it is already on the page, so screen readers skip it", () => {
    const jacket = renderJacket();
    expect(jacket).toHaveAttribute("aria-hidden", "true");
    expect(jacket.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
    expect(jacket.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("is labelled like a tape: format, title on the spine and the front, year and running time, the label", () => {
    const jacket = renderJacket();
    expect(jacket).toHaveTextContent("VHS");
    expect(jacket).toHaveTextContent("PAL");
    expect(jacket.querySelector("[data-vhs-spine]")).toHaveTextContent("Film test");
    expect(within(jacket).getAllByText("Film test")).toHaveLength(2);
    expect(jacket.querySelector("[data-vhs-meta]")).toHaveTextContent("2024 · 12 min");
    expect(jacket).toHaveTextContent("ELMZN · Création");
  });

  it("reads its spine upwards in French, downwards in English, as on each language's shelves", () => {
    expect(renderJacket().querySelector("[data-vhs-spine]")).toHaveClass("[writing-mode:vertical-rl]", "rotate-180");
    expect(renderJacket({ locale: "en" }).querySelector("[data-vhs-spine]")).not.toHaveClass("rotate-180");
  });

  it("shows the cover as box art, asking for the very file the page's cover uses", () => {
    const img = renderJacket().querySelector("img")!;
    expect(img).toHaveAttribute("sizes", "(min-width: 1024px) 64rem, 100vw");
    expect(img.getAttribute("src")).toContain(encodeURIComponent(COVER));
  });

  it("paints a sunset of its own without a cover, and leaves out what it does not know", () => {
    const jacket = renderJacket({ cover: undefined, year: undefined, duration: undefined });
    expect(jacket.querySelector("img")).toBeNull();
    expect(jacket.querySelector(".vhs-art svg circle")).toHaveClass("fill-chapter-accent");
    expect(jacket.querySelector("[data-vhs-meta]")).toBeEmptyDOMElement();
  });

  it("marks a title in the other language, on the spine and the front", () => {
    const jacket = renderJacket({ lang: "fr", locale: "en" });
    for (const title of within(jacket).getAllByText("Film test")) expect(title).toHaveAttribute("lang", "fr");
  });

  it("turns on its spine, in the chapter's colours only", () => {
    const jacket = renderJacket({ cover: undefined });
    expect(jacket.querySelector(".vhs-case")).not.toBeNull();
    const colours = [...jacket.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => /^(bg|text|fill|stroke|border)-(?!current|\[)/.test(c) && !/^(text|border)-(2xs|xs|sm|lg|xl)$/.test(c));
    for (const name of colours) expect(name, name).toMatch(/-(chapter-[a-z-]+)$|^border$/);
  });
});

describe("SpecSheet — the credits' running time", () => {
  it("shows a duration only on a sheet that names one", () => {
    render(<SpecSheet copy={fr.projectPage.credits} locale="fr" role="" duration={95} stack={[]} />);
    const time = screen.getByText("1 h 35");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "PT1H35M");
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Durée"]);
  });

  it("ignores a duration on the dev spec sheet", () => {
    const { container } = render(<SpecSheet copy={fr.projectPage.specs} locale="fr" role="" duration={95} stack={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProjectView — the creative chapter's jacket and credits", () => {
  const film = (overrides: Partial<LocalizedProject> = {}) =>
    project({
      chapter: "creative",
      title: "Film test",
      year: 2024,
      duration: 12,
      role: "Réalisation et montage",
      stack: ["Sony A7 IV", "DaVinci Resolve"],
      ...overrides,
    });

  it("heads a creative project with its jacket, then its credits in reading order", () => {
    const { container } = render(<ProjectView locale="fr" dict={fr} project={film()} images={sizes} />);
    const header = container.querySelector("article > header") as HTMLElement;
    expect(header.querySelector("[data-vhs]")).not.toBeNull();
    const credits = within(header).getByRole("region", { name: "Générique" });
    expect(within(credits).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Année",
      "Rôle",
      "Durée",
      "Matériel",
    ]);
    expect(within(credits).getByText("12 min")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(credits)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("names the credits in the page's language", () => {
    render(<ProjectView locale="en" dict={en} project={film({ roleLang: "fr" })} images={sizes} />);
    const credits = screen.getByRole("region", { name: "Credits" });
    expect(within(credits).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Year",
      "Role",
      "Running time",
      "Gear",
    ]);
    expect(within(credits).getByText("Réalisation et montage")).toHaveAttribute("lang", "fr");
  });

  it("keeps the page cover's own image, described, alongside the jacket's box art", () => {
    render(<ProjectView locale="fr" dict={fr} project={film()} images={sizes} />);
    expect(screen.getAllByRole("img")).toHaveLength(1); // the jacket's copy is hidden
    expect(screen.getByRole("img", { name: "Dégradé indigo." })).toHaveAttribute("sizes", "(min-width: 1024px) 64rem, 100vw");
  });

  it("is the creative chapter's object only", () => {
    for (const chapter of ["dev", "infra", "repair"] as const) {
      const { container, unmount } = render(
        <ProjectView locale="fr" dict={fr} project={film({ chapter })} images={sizes} />,
      );
      expect(container.querySelector("[data-vhs]"), chapter).toBeNull();
      expect(screen.queryByRole("region", { name: "Générique" }), chapter).toBeNull();
      unmount();
    }
  });
});
