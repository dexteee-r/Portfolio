/**
 * French is the reference dictionary: its shape is the `Dictionary` type every
 * other language must match key for key.
 * `{count}` is replaced at runtime; see `formatCount`.
 */
export const fr = {
  meta: {
    title: "ELMZN — développement, infrastructure, réparation, création",
    description:
      "Développeur full-stack et infrastructure, en Belgique. Je répare et je filme aussi.",
    jobTitle: "Développeur full-stack et infrastructure",
  },
  skipLink: "Aller au contenu",
  topBar: {
    homeLabel: "ELMZN — retour au bureau",
    location: "Belgique",
    clockLabel: "Heure locale en Belgique",
    breadcrumbLabel: "Fil d'Ariane",
  },
  language: {
    label: "Langue",
  },
  boot: {
    phrase: "Tout commence par un dossier vide.",
  },
  desk: {
    identity:
      "Développeur full-stack et infrastructure, en Belgique. Je répare et je filme aussi.",
    chaptersLabel: "Chapitres",
  },
  chapters: {
    dev: {
      name: "Développement",
      description: "Applications, sites et outils que j'ai conçus et développés.",
    },
    infra: {
      name: "Infrastructure",
      description: "Serveurs, réseau et supervision : l'infrastructure que je monte et que j'entretiens.",
    },
    repair: {
      name: "Réparation",
      description: "Réparation de téléphones et de PC : diagnostic, démontage, remise en état.",
    },
    creative: {
      name: "Création",
      description: "Création audiovisuelle : vidéo, animation et photo.",
    },
  },
  chapterPage: {
    backToDesk: "Retour au bureau",
    escapeHint: "Échap",
    stationsLabel: "Projets",
    empty: "Ce dossier est encore vide.",
    open: "Ouvrir le dossier",
    draft: "Brouillon",
  },
  projectPage: {
    backToChapter: "Retour au chapitre",
    linksLabel: "Liens du projet",
    links: {
      site: "Voir le site",
      repo: "Code source",
      video: "Voir la vidéo",
      download: "Télécharger",
    },
    siblingsLabel: "Autres projets du chapitre",
    previous: "Projet précédent",
    next: "Projet suivant",
  },
  projectCount: {
    one: "{count} projet",
    other: "{count} projets",
  },
  notFound: {
    title: "Ce dossier n'existe pas.",
    body: "Il a peut-être été renommé, déplacé, ou il n'a jamais été créé. Les quatre dossiers ci-dessous, eux, existent bien.",
    back: "Retour au bureau",
  },
};
