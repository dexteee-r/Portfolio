import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticScan, LABEL_INSIDE_BELOW, LABEL_RIGHT_FROM } from "@/components/DiagnosticScan";
import { ProjectView } from "@/components/ProjectView";
import type { LocalizedProject } from "@/content/projects";
import type { ScanMarker } from "@/content/schema";
import { getDictionary } from "@/i18n/dictionaries";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/repair/ecran" }));

const fr = getDictionary("fr");
const en = getDictionary("en");
const COVER = "/media/fixtures/alpha-shot.png";
const SIZE = { width: 1200, height: 900 };
const MARKERS: ScanMarker[] = [
  { label: "Vitre arrière", x: 10, y: 20, w: 40, h: 50 },
  { label: "Nappe du flash", x: 65, y: 4, w: 25, h: 20 },
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

const renderScan = (props: Partial<Parameters<typeof DiagnosticScan>[0]> = {}) =>
  render(
    <DiagnosticScan
      cover={COVER}
      alt="La vitre arrière, démontée."
      size={SIZE}
      sizes="(min-width: 1024px) 64rem, 100vw"
      markers={MARKERS}
      copy={fr.projectPage.scan}
      {...props}
    />,
  ).container.querySelector<HTMLElement>("[data-scan]")!;

describe("DiagnosticScan", () => {
  it("keeps the photo's own proportions, so the boxes land where they were drawn", () => {
    const frame = renderScan().querySelector<HTMLElement>("img")!.parentElement!;
    expect(frame.style.aspectRatio).toBe("1200 / 900");
    // Never taller than 80% of the screen: a portrait photo narrows instead.
    expect(frame.style.width).toBe(`min(100%, ${80 * (1200 / 900)}vh)`);
  });

  it("boxes each part in percent of the photo, numbered and named", () => {
    const marks = [...renderScan().querySelectorAll<HTMLElement>("[data-scan-mark]")];
    expect(marks).toHaveLength(2);
    expect(marks[0]!.style).toMatchObject({ left: "10%", top: "20%", width: "40%", height: "50%" });
    expect(marks[0]!.style.getPropertyValue("--at")).toBe("0.2");
    expect(marks.map((m) => m.textContent)).toEqual(["01 Vitre arrière", "02 Nappe du flash"]);
    expect(marks[0]).toHaveClass("border-chapter-accent");
  });

  it("keeps every label inside the photo: inside a box at the top, on the right edge of a box on the right", () => {
    const [left, topRight] = [...renderScan().querySelectorAll<HTMLElement>("[data-scan-mark] > span")];
    expect(left).toHaveClass("bottom-full", "left-0");
    expect(topRight).toHaveClass("top-0", "right-0");
    expect(MARKERS[1]!.y).toBeLessThan(LABEL_INSIDE_BELOW);
    expect(MARKERS[1]!.x).toBeGreaterThanOrEqual(LABEL_RIGHT_FROM);
  });

  it("is a described photo; the scanner is decoration, its findings said in words", () => {
    const scan = renderScan();
    expect(screen.getByRole("img", { name: "La vitre arrière, démontée." })).toBeInTheDocument();
    const overlay = scan.querySelector("[data-scan-mark]")!.parentElement!;
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(scan.querySelector("figcaption")).toHaveTextContent("Pièces repérées sur la photo : Vitre arrière, Nappe du flash.");
    expect(scan.querySelector("[data-scan-count]")).toHaveTextContent("Pièces 02");
  });

  it("marks labels written in the other language, on the photo and in the caption", () => {
    const scan = renderScan({ copy: en.projectPage.scan, markersLang: "fr" });
    expect(scan.querySelector("figcaption")).toHaveTextContent("Parts spotted on the photo: Vitre arrière, Nappe du flash.");
    expect(scan.querySelector("figcaption span[lang]")).toHaveAttribute("lang", "fr");
    for (const label of scan.querySelectorAll("[data-scan-mark] > span")) expect(label).toHaveAttribute("lang", "fr");
  });

  it("waits to be seen before scanning — only once the script is there to reveal the boxes", () => {
    const see = observer();
    const scan = renderScan();
    expect(scan).toHaveAttribute("data-armed");
    expect(scan).not.toHaveAttribute("data-scanned");
    see(false);
    expect(scan).not.toHaveAttribute("data-scanned");
    see(true);
    expect(scan).toHaveAttribute("data-scanned");
  });

  it("shows the boxes at once under reduced motion, or without an IntersectionObserver", () => {
    observer();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches: query.includes("reduce") }),
    });
    expect(renderScan()).not.toHaveAttribute("data-armed");
    vi.unstubAllGlobals();
    // @ts-expect-error — jsdom again
    delete window.matchMedia;
    expect(renderScan()).not.toHaveAttribute("data-armed");
  });
});

describe("ProjectView — the repair chapter's diagnostic scan", () => {
  function repair(overrides: Partial<LocalizedProject> = {}): LocalizedProject {
    return {
      slug: "ecran",
      chapter: "repair",
      status: "published",
      title: "Écran",
      summary: "Une réparation.",
      lang: "fr",
      body: "",
      bodyLang: "fr",
      cover: COVER,
      coverAlt: "La vitre arrière, démontée.",
      links: [],
      stack: [],
      role: "",
      roleLang: "fr",
      scan: MARKERS,
      scanLang: "fr",
      ...overrides,
    };
  }
  const images = { [COVER]: SIZE };

  it("draws the cover through the scanner when the repair names its parts", () => {
    const { container } = render(<ProjectView locale="fr" dict={fr} project={repair()} images={images} />);
    expect(container.querySelector("[data-scan]")).not.toBeNull();
    expect(container.querySelectorAll("[data-scan-mark]")).toHaveLength(2);
    expect(screen.getAllByRole("img")).toHaveLength(1); // the scan replaces the plain cover
  });

  it("keeps the plain cover when there is nothing to scan, or the photo's size is unknown", () => {
    for (const [project, sizes] of [
      [repair({ scan: [] }), images],
      [repair(), {}],
    ] as const) {
      const { container, unmount } = render(<ProjectView locale="fr" dict={fr} project={project} images={sizes} />);
      expect(container.querySelector("[data-scan]")).toBeNull();
      expect(screen.getByRole("img", { name: "La vitre arrière, démontée." })).toBeInTheDocument();
      unmount();
    }
  });

  it("is the repair chapter's effect only", () => {
    for (const chapter of ["dev", "infra", "creative"] as const) {
      const { container, unmount } = render(
        <ProjectView locale="fr" dict={fr} project={repair({ chapter })} images={images} />,
      );
      expect(container.querySelector("[data-scan]"), chapter).toBeNull();
      unmount();
    }
  });

  it("marks French labels on the English page", () => {
    const { container } = render(
      <ProjectView locale="en" dict={en} project={repair({ scanLang: "fr" })} images={images} />,
    );
    expect(container.querySelector("[data-scan-mark] > span")).toHaveAttribute("lang", "fr");
  });
});
