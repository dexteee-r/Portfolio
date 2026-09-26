import type { Dictionary } from "./index";

export const en: Dictionary = {
  meta: {
    title: "ELMZN — development, infrastructure, repair, film",
    description:
      "Full-stack and infrastructure developer, based in Belgium. I also repair devices and shoot video.",
    jobTitle: "Full-stack and infrastructure developer",
  },
  skipLink: "Skip to content",
  topBar: {
    homeLabel: "ELMZN — back to the desk",
    location: "Belgium",
    clockLabel: "Local time in Belgium",
    breadcrumbLabel: "Breadcrumb",
  },
  language: {
    label: "Language",
  },
  boot: {
    phrase: "Everything starts with an empty folder.",
  },
  desk: {
    identity:
      "Full-stack and infrastructure developer, based in Belgium. I also repair devices and shoot video.",
    chaptersLabel: "Chapters",
  },
  chapters: {
    dev: {
      name: "Development",
      description: "Apps, websites and tools I designed and built.",
    },
    infra: {
      name: "Infrastructure",
      description: "Servers, networking and monitoring: the infrastructure I build and look after.",
    },
    repair: {
      name: "Repair",
      description: "Phone and PC repair: diagnosis, teardown, restoration.",
    },
    creative: {
      name: "Creative",
      description: "Audiovisual work: video, animation and photography.",
    },
  },
  chapterPage: {
    backToDesk: "Back to the desk",
    escapeHint: "Esc",
    stationsLabel: "Projects",
    empty: "This folder is still empty.",
    open: "Open the folder",
    draft: "Draft",
  },
  projectPage: {
    backToChapter: "Back to the chapter",
    linksLabel: "Project links",
    links: {
      site: "Visit the site",
      repo: "Source code",
      video: "Watch the video",
      download: "Download",
    },
    siblingsLabel: "More projects in this chapter",
    previous: "Previous project",
    next: "Next project",
  },
  projectCount: {
    one: "{count} project",
    other: "{count} projects",
  },
  notFound: {
    title: "This folder doesn't exist.",
    body: "It may have been renamed, moved, or never created. The four folders below do exist.",
    back: "Back to the desk",
  },
};
