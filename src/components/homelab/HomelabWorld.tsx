import Link from "next/link";
import type { HomelabNode } from "@/content/network-layout";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import { formatCount, type Dictionary } from "@/i18n/dictionaries";
import { projectPath } from "@/i18n/paths";
import { ChapterName } from "../ChapterName";
import { BootLog } from "./BootLog";
import { MachineUnit, machinesOf, rackSlots } from "./MachineUnit";

/** The boot log's lines: the homelab coming up, one machine or service at a time. */
export function bootLines(dict: Dictionary, network: HomelabNode[]): string[] {
  return [
    dict.homelabWorld.boot,
    ...network.map((node) => `${node.label.toLowerCase().padEnd(22, ".")} ${dict.network.kinds[node.kind].toLowerCase()}`),
  ];
}

interface HomelabWorldProps {
  locale: Locale;
  dict: Dictionary;
  stations: LocalizedProject[];
  publishedCount: number;
  /** The homelab, in the page's language; none, no machines. */
  network?: HomelabNode[] | null;
}

/**
 * The Homelab chapter's world — « console phosphore ». The homelab boots
 * above the title; below, the machines themselves and what each runs
 * (MachineUnit) — a rack on a wide screen, a shelf on a phone — then every
 * project of the chapter, as folders.
 *
 * Complete in the HTML: title, description, every machine, every link. The
 * boot log's replay, the title's flicker and the lights are motion, stilled
 * under reduced motion.
 */
export function HomelabWorld({ locale, dict, stations, publishedCount, network = null }: HomelabWorldProps) {
  const copy = dict.chapters.infra;
  const nodes = network && network.length > 1 ? network : null;
  const machines = nodes ? machinesOf(nodes) : [];
  const slots = rackSlots(machines);

  const head = (
    <header className="homelab-head">
      {nodes && <BootLog lines={bootLines(dict, nodes)} />}
      <p className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
        {formatCount(locale, publishedCount, dict.projectCount)}
      </p>
      <h1
        data-view-title=""
        tabIndex={-1}
        className="homelab-title mt-3 text-4xl leading-tight font-semibold tracking-display text-chapter-ink hyphens-auto wrap-break-word"
      >
        <ChapterName name={copy.name} />
      </h1>
      <p className="mt-6 max-w-measure text-lg leading-snug text-chapter-muted">{copy.description}</p>
    </header>
  );

  return (
    <main id="content" data-world="infra" className="flex-1">
      <section className="homelab-hero px-gutter pt-12 pb-10 md:pt-16 md:pb-12">{head}</section>

      <section className="homelab-rack-room px-gutter pt-6 pb-16 md:pt-8 md:pb-24">
        {machines.length > 0 && (
          <>
            <p aria-hidden="true" className="font-mono text-2xs uppercase tracking-label text-chapter-accent-text">
              {formatCount(locale, machines.length, dict.homelabWorld.rack)}
            </p>
            <ol aria-label={dict.homelabWorld.machinesLabel} className="homelab-rack mt-5">
              {machines.map((machine, index) => (
                <li key={machine.id}>
                  <MachineUnit machine={machine} nodes={nodes!} dict={dict} slot={slots[index]!} />
                </li>
              ))}
            </ol>
          </>
        )}

        {/* Every project of the chapter, whether or not a machine names it. */}
        <nav aria-label={dict.homelabWorld.folders} className="homelab-folders">
          <p aria-hidden="true" className="font-mono text-2xs uppercase tracking-label text-chapter-muted">
            {dict.homelabWorld.folders}
          </p>
          {stations.length > 0 ? (
            <ul aria-label={dict.chapterPage.stationsLabel}>
              {stations.map((project) => (
                <li key={project.slug} data-station={project.slug} lang={project.lang === locale ? undefined : project.lang}>
                  <Link href={projectPath(locale, project.chapter, project.slug)} className="folder-link">
                    {project.title}
                  </Link>
                  {project.status === "draft" && (
                    <span className="ml-2 rounded-sm border border-chapter-muted px-1.5 py-0.5 align-middle font-mono text-2xs uppercase tracking-label">
                      {dict.chapterPage.draft}
                    </span>
                  )}
                  {project.year !== undefined && <span className="folder-year">{project.year}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-chapter-ink">{dict.chapterPage.empty}</p>
          )}
        </nav>
      </section>
    </main>
  );
}
