import Image from "next/image";
import Link from "next/link";
import type { LocalizedProject } from "@/content/projects";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { projectPath } from "@/i18n/paths";
import { FolderGlyph } from "./FolderGlyph";
import { blurPlaceholder } from "./placeholder";

/** With fewer projects, the stations below say it all: no index. */
export const DRAWER_MIN_PROJECTS = 2;

/**
 * Where each folder's tab sits. Like the dividers of a real drawer, the tabs
 * step across — left, middle, right — so each one shows behind the others.
 */
const TABS = [
  { tab: "self-start", body: "rounded-tl-none" },
  { tab: "self-center", body: "" },
  { tab: "self-end", body: "rounded-tr-none" },
] as const;

export function tabPlacement(index: number) {
  return TABS[index % TABS.length]!;
}

interface DrawerIndexProps {
  locale: Locale;
  dict: Dictionary;
  /** The chapter's visible projects, in station order. */
  projects: LocalizedProject[];
}

/**
 * The drawer, open: the chapter's projects as hanging folders, side by side,
 * each with its numbered tab and a strip of its cover, its name along the
 * spine. A folder widens under the pointer or the keyboard's focus; taking
 * one out opens the project. On a phone, the drawer scrolls sideways.
 *
 * It sits above the stations — the contents of the drawer at a glance,
 * before the stroll through them.
 */
export function DrawerIndex({ locale, dict, projects }: DrawerIndexProps) {
  if (projects.length < DRAWER_MIN_PROJECTS) return null;

  return (
    <nav aria-label={dict.chapterPage.drawerLabel} className="mt-12 md:mt-16">
      {/* On a phone, the drawer runs edge to edge and scrolls sideways; each
          folder snaps into place with the page's own margin before it. */}
      <ol className="-mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-2 overflow-x-auto px-gutter pb-2 md:mx-0 md:max-w-content md:overflow-visible md:px-0 md:pb-0">
        {projects.map((project, index) => {
          const placement = tabPlacement(index);
          return (
            <li
              key={project.slug}
              data-folder={project.slug}
              className="flex w-36 shrink-0 snap-start md:w-auto md:min-w-0 md:shrink md:grow md:basis-0 md:transition-[flex-grow] md:duration-(--duration-base) md:ease-standard md:hover:grow-[3] md:focus-within:grow-[3]"
            >
              <Link
                href={projectPath(locale, project.chapter, project.slug)}
                lang={project.lang === locale ? undefined : project.lang}
                className="group/folder flex w-full flex-col rounded-sm focus-visible:outline-offset-4"
              >
                <span
                  aria-hidden="true"
                  className={`${placement.tab} rounded-t-sm bg-chapter-surface px-3 pt-1.5 pb-1 font-mono text-2xs tracking-label text-chapter-muted group-hover/folder:text-chapter-accent-text group-focus-visible/folder:text-chapter-accent-text`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`flex h-56 overflow-hidden rounded-sm bg-chapter-surface md:h-72 ${placement.body}`}
                >
                  <span className="flex w-9 shrink-0 items-center justify-center border-r border-chapter-line py-3">
                    <span className="max-h-full rotate-180 truncate font-mono text-2xs uppercase tracking-label text-chapter-ink [writing-mode:vertical-rl]">
                      {project.title}
                    </span>
                  </span>
                  <span className="relative flex-1">
                    {project.cover ? (
                      <Image
                        src={project.cover}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 40vw, 7rem"
                        className="object-cover transition-transform duration-(--duration-slow) ease-standard group-hover/folder:scale-[1.03]"
                        {...blurPlaceholder(project.coverBlur)}
                      />
                    ) : (
                      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                        <FolderGlyph className="w-10 text-chapter-accent" />
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
