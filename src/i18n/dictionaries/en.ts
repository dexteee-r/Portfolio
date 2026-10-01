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
    pullHint: "or pull down from the top of the page",
    stationsLabel: "Projects",
    drawerLabel: "Folder contents",
    empty: "This folder is still empty.",
    open: "Open the folder",
    draft: "Draft",
    preview: "Preview",
  },
  network: {
    caption: "The homelab, as it runs",
    kinds: {
      internet: "Internet",
      router: "Router",
      proxy: "Reverse proxy",
      hypervisor: "Hypervisor",
      nas: "NAS",
      vm: "Virtual machine",
      container: "Container",
      service: "Service",
    },
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
    specs: {
      heading: "Spec sheet",
      year: "Year",
      role: "Role",
      stack: "Stack",
    },
    credits: {
      heading: "Credits",
      year: "Year",
      role: "Role",
      duration: "Running time",
      stack: "Gear",
    },
    scan: {
      mode: "Scan · diagnostics",
      parts: "Parts",
      caption: "Parts spotted on the photo: {parts}.",
    },
    ticket: {
      heading: "Repair ticket",
      number: "No.",
      device: "Device",
      fix: "Repair",
      duration: "Time",
      year: "Year",
      workshop: "Workshop",
    },
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
  footer: {
    contact: "Contact",
    legal: "Legal notice",
  },
  legal: {
    title: "Legal notice",
    description: "Who publishes this site, who hosts it, and what it does with your data.",
    updated: "Last updated {date}",
    publisherHeading: "Publisher",
    publisherLabel: "Publisher",
    publisherValue: "{name}, as a private individual",
    contactLabel: "Contact",
    countryLabel: "Country",
    businessLabel: "Business",
    addressLabel: "Address",
    enterpriseNumberLabel: "Enterprise number",
    vatLabel: "VAT",
    personal:
      "This is a personal portfolio. The repairs shown here are done privately, for people I know and free of charge: no commercial activity is carried out through this site.",
    hostingHeading: "Hosting",
    hosting:
      "The site is self-hosted by its publisher, on a server in {country}. No third-party host sees the visits.",
    privacyHeading: "Your data",
    controller: "The data controller is {name}, reachable at {email}.",
    noTrackingHeading: "No cookies, no analytics",
    noTracking: "This site sets no cookies on its visitors and uses no analytics, no trackers and no advertising.",
    storageHeading: "What your browser keeps",
    storage:
      "Your browser stores a single piece of information: that you have already seen the opening animation, so it does not play on every visit. It never leaves your device; clearing the site's data in your browser removes it.",
    logsHeading: "Server logs",
    logs:
      "To serve the pages and protect the site, the server records every request in its logs: IP address, page requested, browser. This is necessary for the site to work and stay secure (legitimate interest). These logs stay on the server, are shared with no one, and are deleted automatically after {retention} at most.",
    logRetention: {
      one: "{count} week",
      other: "{count} weeks",
    },
    mailHeading: "If you write to me",
    mail:
      "What you send to {email} — your address, your name, your message — is used only to reply and, for a repair, to follow it up, at your request. Messages are received by {mailHost}'s mail service ({mailCountry}), shared with no one else, and deleted {retention} after the last exchange.",
    mailRetention: {
      one: "{count} month",
      other: "{count} months",
    },
    rightsHeading: "Your rights",
    rights:
      "You can ask to see, correct or erase the data about you, or object to its use, by writing to {email}. If the answer does not satisfy you, you can lodge a complaint with the Belgian {authority}, Rue de la Presse 35, 1000 Brussels.",
    authority: "Data Protection Authority",
    authorityUrl: "https://www.dataprotectionauthority.be",
    contentHeading: "Content",
    content:
      "Unless stated otherwise, the texts, photos and videos on this site are the work of {name}; reproducing them requires the author's permission. The site's code, on the other hand, is public: {source}.",
    sourceLink: "see it on GitHub",
  },
};
