import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterView } from "@/components/ChapterView";
import { Desk } from "@/components/Desk";
import { countryName, LegalView } from "@/components/LegalView";
import { NotFoundView } from "@/components/NotFoundView";
import { ProjectView } from "@/components/ProjectView";
import { profileLinks, SiteFooter } from "@/components/SiteFooter";
import type { LocalizedProject } from "@/content/projects";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatLongDate } from "@/lib/time";
import { site, type LocalBusinessInfo } from "@/site";

const pathname = vi.hoisted(() => ({ current: "/fr/mentions-legales" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const fr = getDictionary("fr");
const en = getDictionary("en");

beforeEach(() => {
  pathname.current = "/fr/mentions-legales";
});

const BUSINESS: LocalBusinessInfo = {
  name: "ELMZN Réparation",
  email: "contact@elmzn.be",
  street: "Rue de l'Exemple 1",
  postalCode: "1000",
  locality: "Bruxelles",
  country: "BE",
  enterpriseNumber: "0123.456.789",
  vatId: "BE0123456789",
};

describe("LegalView", () => {
  it("is a page of the frame, titled, whose title takes focus on arrival", () => {
    const { container } = render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(container.firstElementChild).toHaveAttribute("data-view", "frame");
    expect(container.firstElementChild).not.toHaveAttribute("data-chapter");
    const title = screen.getByRole("heading", { level: 1, name: "Mentions légales" });
    expect(title).toHaveAttribute("data-view-title");
    expect(title).toHaveAttribute("tabindex", "-1");
  });

  it("reads as a path in the top bar: ELMZN / mentions-legales", () => {
    render(<LegalView locale="fr" dict={fr} business={null} />);
    const trail = screen.getByRole("navigation", { name: fr.topBar.breadcrumbLabel });
    expect(within(trail).getByText("mentions-legales").closest("li")).toHaveAttribute("aria-current", "page");
  });

  it("names the publisher, a private person, and how to reach them", () => {
    render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByText(`${site.publisher.name}, à titre personnel`)).toBeInTheDocument();
    const facts = screen.getByRole("main").querySelector("dl")!;
    const mail = within(facts).getByRole("link", { name: site.email });
    expect(mail).toHaveAttribute("href", `mailto:${site.email}`);
    expect(within(facts).getByText("Pays").nextElementSibling).toHaveTextContent("Belgique");
  });

  it("says the repairs are private and unpaid, as long as no business is registered", () => {
    render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByText(fr.legal.personal)).toBeInTheDocument();
    expect(screen.queryByText(fr.legal.enterpriseNumberLabel)).not.toBeInTheDocument();
  });

  it("shows the business details on their own once the activity is registered", () => {
    render(<LegalView locale="fr" dict={fr} business={BUSINESS} />);
    expect(screen.getByText("ELMZN Réparation")).toBeInTheDocument();
    expect(screen.getByText("Rue de l'Exemple 1, 1000 Bruxelles, Belgique")).toBeInTheDocument();
    expect(screen.getByText("0123.456.789")).toBeInTheDocument();
    expect(screen.getByText("BE0123456789")).toBeInTheDocument();
    expect(screen.queryByText(fr.legal.personal)).not.toBeInTheDocument();
  });

  it("leaves the VAT line out when the business is not subject to VAT", () => {
    render(<LegalView locale="fr" dict={fr} business={{ ...BUSINESS, vatId: undefined }} />);
    expect(screen.queryByText(fr.legal.vatLabel)).not.toBeInTheDocument();
  });

  it("says the site is self-hosted, in Belgium, with no hosting company in between", () => {
    const { unmount } = render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByText(/auto-hébergé/).textContent).toBe(
      "Le site est auto-hébergé par son éditeur, sur un serveur situé en Belgique. Aucun hébergeur tiers ne voit passer les visites.",
    );
    unmount();
    render(<LegalView locale="en" dict={en} business={null} />);
    expect(screen.getByText(/self-hosted/).textContent).toContain("on a server in Belgium");
  });

  it("promises the mail retention it is configured with, pluralised in each language", () => {
    const { unmount } = render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByText(/sont supprimés/).textContent).toContain(`${site.emailRetentionMonths} mois après`);
    unmount();
    render(<LegalView locale="en" dict={en} business={null} />);
    const count: number = site.emailRetentionMonths;
    const months = count === 1 ? "1 month" : `${count} months`;
    expect(screen.getByText(/deleted \d/).textContent).toContain(`${months} after the last exchange`);
  });

  it("promises the server-log retention it is configured with", () => {
    const { unmount } = render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByText(/journaux :/).textContent).toContain(
      `effacés automatiquement, au plus tard après ${site.serverLogRetentionWeeks} semaines.`,
    );
    unmount();
    render(<LegalView locale="en" dict={en} business={null} />);
    expect(screen.getByText(/in its logs/).textContent).toContain(`after ${site.serverLogRetentionWeeks} weeks at most`);
  });

  it("dates its last revision, machine-readable", () => {
    render(<LegalView locale="fr" dict={fr} business={null} />);
    const time = screen.getByRole("main").querySelector("time")!;
    expect(time).toHaveAttribute("datetime", site.legalUpdated);
    expect(time.textContent).toBe(formatLongDate(site.legalUpdated, "fr"));
  });

  it("points to the data protection authority and the site's code", () => {
    render(<LegalView locale="fr" dict={fr} business={null} />);
    expect(screen.getByRole("link", { name: fr.legal.authority })).toHaveAttribute("href", fr.legal.authorityUrl);
    expect(screen.getByRole("link", { name: fr.legal.sourceLink })).toHaveAttribute("href", site.sourceCode);
  });

  it.each(locales)("%s: every placeholder is filled, in both layouts", (locale) => {
    for (const business of [null, BUSINESS]) {
      const { container, unmount } = render(<LegalView locale={locale} dict={getDictionary(locale)} business={business} />);
      expect(container.textContent).not.toMatch(/\{\w+\}/);
      unmount();
    }
  });

  it.each(locales)("%s: one title, then sections, then their parts — a clean outline", (locale) => {
    const { container } = render(<LegalView locale={locale} dict={getDictionary(locale)} business={null} />);
    const levels = [...container.querySelectorAll("h1, h2, h3")].map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });

  it.each(locales)("%s: every outside link is https", (locale) => {
    const { container } = render(<LegalView locale={locale} dict={getDictionary(locale)} business={null} />);
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) {
      expect(a.getAttribute("href"), a.textContent ?? "").toMatch(/^https:\/\//);
    }
  });
});

describe("dates and countries", () => {
  it("are written in the page's language", () => {
    expect(formatLongDate("2026-09-28", "fr")).toBe("28 septembre 2026");
    expect(formatLongDate("2026-09-28", "en")).toBe("28 September 2026");
    expect(formatLongDate("2026-01-01", "en")).toBe("1 January 2026"); // no time-zone slip to the day before
    expect(countryName("fr", "FR")).toBe("France");
    expect(countryName("en", "BE")).toBe("Belgium");
  });
});

describe("SiteFooter", () => {
  it("gives the address in clear, clickable, never obfuscated", () => {
    render(<SiteFooter locale="fr" dict={fr} />);
    const footer = screen.getByRole("contentinfo");
    const mail = within(footer).getByRole("link", { name: site.email });
    expect(mail).toHaveAttribute("href", `mailto:${site.email}`);
    expect(mail.textContent).toBe(site.email);
    expect(footer.innerHTML).toContain(site.email); // in the HTML itself, not assembled by a script
  });

  it("links every known profile as the owner's own", () => {
    render(<SiteFooter locale="fr" dict={fr} />);
    for (const profile of profileLinks()) {
      const link = screen.getByRole("link", { name: new RegExp(`^${profile.name}`) });
      expect(link).toHaveAttribute("href", profile.url);
      expect(link).toHaveAttribute("rel", "me");
    }
    expect(profileLinks().map((p) => p.name)).toEqual(["Instagram", "GitHub"]);
  });

  it("leaves out a profile that is not filled in", () => {
    expect(profileLinks({ instagram: "https://instagram.com/x", github: "" })).toEqual([
      { name: "Instagram", url: "https://instagram.com/x", icon: "instagram" },
    ]);
  });

  it("puts an icon before each way of reaching the owner — decorative, the words name the link", () => {
    render(<SiteFooter locale="fr" dict={fr} />);
    const footer = screen.getByRole("contentinfo");
    const links = [
      within(footer).getByRole("link", { name: site.email }),
      within(footer).getByRole("link", { name: /^Instagram/ }),
      within(footer).getByRole("link", { name: /^GitHub/ }),
    ];
    for (const link of links) {
      const icon = link.querySelector("svg")!;
      expect(icon, link.textContent ?? "").not.toBeNull();
      expect(link.firstElementChild).toBe(icon); // before the words
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
    }
    // The address itself is still plain text, whole, inside its link.
    expect(links[0]!.textContent).toBe(site.email);
  });

  it("draws the icons in the text's own colour, never a brand's", () => {
    const { container } = render(<SiteFooter locale="fr" dict={fr} />);
    for (const svg of container.querySelectorAll("footer svg")) {
      const paint = [svg.getAttribute("fill"), svg.getAttribute("stroke")].filter((v) => v && v !== "none");
      expect(paint).toEqual(["currentColor"]);
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
    expect(container.querySelectorAll("footer svg")).toHaveLength(3);
  });

  it("uses the real brand glyphs, unaltered (Simple Icons)", async () => {
    const { siGithub, siInstagram } = await import("simple-icons");
    const { container } = render(<SiteFooter locale="fr" dict={fr} />);
    const paths = [...container.querySelectorAll("footer svg[fill='currentColor'] path")].map((p) => p.getAttribute("d"));
    expect(paths).toEqual([siInstagram.path, siGithub.path]);
  });

  it("links the legal notice in the page's language", () => {
    const { unmount } = render(<SiteFooter locale="fr" dict={fr} />);
    expect(screen.getByRole("link", { name: "Mentions légales" })).toHaveAttribute("href", "/fr/mentions-legales");
    unmount();
    render(<SiteFooter locale="en" dict={en} />);
    expect(screen.getByRole("link", { name: "Legal notice" })).toHaveAttribute("href", "/en/legal-notice");
  });

  it("marks the legal notice as the current page on the legal notice itself", () => {
    render(<SiteFooter locale="fr" dict={fr} current="legal" />);
    expect(screen.getByRole("link", { name: "Mentions légales" })).toHaveAttribute("aria-current", "page");
  });

  it("is labelled by a heading outside the address (a heading may not sit inside <address>)", () => {
    render(<SiteFooter locale="fr" dict={fr} />);
    expect(screen.getByRole("heading", { level: 2, name: "Contact" }).closest("address")).toBeNull();
  });
});

describe("every view ends with the contact footer", () => {
  const project: LocalizedProject = {
    slug: "alpha-app",
    chapter: "dev",
    status: "published",
    title: "Alpha",
    summary: "Une application.",
    lang: "fr",
    body: "",
    bodyLang: "fr",
    coverAlt: "",
    links: [],
    stack: [],
    role: "",
    roleLang: "fr",
  };
  const counts = { dev: 1, infra: 0, repair: 0, creative: 0 };

  it.each([
    ["desk", () => <Desk locale="fr" dict={fr} counts={counts} />],
    ["chapter", () => <ChapterView locale="fr" dict={fr} chapter="dev" stations={[project]} publishedCount={1} />],
    ["project", () => <ProjectView locale="fr" dict={fr} project={project} images={{}} />],
    ["404", () => <NotFoundView locale="fr" dict={fr} counts={counts} />],
    ["legal notice", () => <LegalView locale="fr" dict={fr} business={null} />],
  ])("%s", (_name, view) => {
    render(view());
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveAttribute("id", "contact");
    expect(within(footer).getByRole("link", { name: site.email })).toHaveAttribute("href", `mailto:${site.email}`);
    expect(within(footer).getByRole("link", { name: "Mentions légales" })).toHaveAttribute("href", "/fr/mentions-legales");
  });

  it("keeps the way back up first in a chapter's and a project's footer", () => {
    const { unmount } = render(
      <ChapterView locale="fr" dict={fr} chapter="dev" stations={[project]} publishedCount={1} />,
    );
    expect(within(screen.getByRole("contentinfo")).getAllByRole("link")[0]).toHaveTextContent(fr.chapterPage.backToDesk);
    unmount();
    render(<ProjectView locale="fr" dict={fr} project={project} images={{}} />);
    expect(within(screen.getByRole("contentinfo")).getAllByRole("link")[0]).toHaveTextContent(
      fr.projectPage.backToChapter,
    );
  });
});
