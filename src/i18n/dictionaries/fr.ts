/**
 * French is the reference dictionary: its shape is the `Dictionary` type every
 * other language must match key for key.
 * `{count}` is replaced at runtime; see `formatCount`.
 */
export const fr = {
  meta: {
    title: "ELMZN — développement, homelab, réparation et montage, création",
    description:
      "Bricoleur du numérique en Belgique : des applis et des sites, un homelab, des PC montés et réparés, des téléphones remis en état. Et je filme aussi.",
    jobTitle: "Bricoleur du numérique",
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
      "Bricoleur du numérique en Belgique : des applis et des sites, un homelab, des PC montés et réparés, des téléphones remis en état. Et je filme aussi.",
    chaptersLabel: "Chapitres",
  },
  chapters: {
    dev: {
      name: "Développement",
      description: "Applications, sites et outils que j'ai conçus et développés.",
    },
    infra: {
      name: "Homelab",
      description: "Serveurs, réseau et accès à distance : le homelab que je monte et que j'entretiens.",
    },
    repair: {
      name: "Réparation/Montage",
      description: "Montage de PC, réparation de PC et de téléphones : diagnostic, démontage, remise en état.",
    },
    creative: {
      name: "Création",
      description: "Création audiovisuelle : vidéo, animation et photo.",
    },
  },
  chapterPage: {
    backToDesk: "Retour au bureau",
    escapeHint: "Échap",
    pullHint: "ou tirer vers le bas, en haut de page",
    stationsLabel: "Projets",
    drawerLabel: "Sommaire du dossier",
    empty: "Ce dossier est encore vide.",
    open: "Ouvrir le dossier",
    draft: "Brouillon",
    preview: "Aperçu",
  },
  network: {
    caption: "Le homelab, tel qu'il tourne",
    kinds: {
      internet: "Internet",
      router: "Routeur",
      proxy: "Proxy inverse",
      hypervisor: "Hyperviseur",
      nas: "NAS",
      vm: "Machine virtuelle",
      container: "Conteneur",
      service: "Service",
    },
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
    specs: {
      heading: "Fiche technique",
      year: "Année",
      role: "Rôle",
      stack: "Stack",
    },
    credits: {
      heading: "Générique",
      year: "Année",
      role: "Rôle",
      duration: "Durée",
      stack: "Matériel",
    },
    scan: {
      mode: "Scan · diagnostic",
      parts: "Pièces",
      caption: "Pièces repérées sur la photo : {parts}.",
    },
    ticket: {
      heading: "Fiche d'intervention",
      number: "N°",
      device: "Appareil",
      fix: "Intervention",
      duration: "Durée",
      year: "Année",
      workshop: "Atelier",
    },
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
  footer: {
    contact: "Contact",
    legal: "Mentions légales",
  },
  /**
   * The legal notice and privacy note. `{name}`-style placeholders are filled
   * by the page, most of them with links; see `interpolate`.
   */
  legal: {
    title: "Mentions légales",
    description: "Qui publie ce site, qui l'héberge, et ce qu'il fait de vos données.",
    updated: "Mis à jour le {date}",
    publisherHeading: "Éditeur",
    publisherLabel: "Éditeur",
    publisherValue: "{name}, à titre personnel",
    contactLabel: "Contact",
    countryLabel: "Pays",
    businessLabel: "Entreprise",
    addressLabel: "Adresse",
    enterpriseNumberLabel: "Numéro d'entreprise",
    vatLabel: "TVA",
    personal:
      "Ce site est un portfolio personnel. Les réparations qui y sont présentées sont faites à titre privé, pour des proches et sans rémunération : aucune activité commerciale n'est exercée par son intermédiaire.",
    hostingHeading: "Hébergement",
    hosting:
      "Le site est auto-hébergé par son éditeur, sur un serveur situé en {country}. Aucun hébergeur tiers ne voit passer les visites.",
    privacyHeading: "Vos données",
    controller: "Le responsable du traitement est {name}, joignable à {email}.",
    noTrackingHeading: "Aucun cookie, aucune mesure d'audience",
    noTracking:
      "Ce site ne dépose aucun cookie chez ses visiteurs et n'utilise ni outil de mesure d'audience, ni traceur, ni publicité.",
    storageHeading: "Ce que garde votre navigateur",
    storage:
      "Une seule information est enregistrée dans votre navigateur : le fait d'avoir déjà vu l'animation d'ouverture, pour ne pas la rejouer à chaque visite. Elle ne quitte jamais votre appareil ; effacer les données du site dans votre navigateur la supprime.",
    logsHeading: "Journaux du serveur",
    logs:
      "Pour servir les pages et protéger le site, le serveur enregistre chaque requête dans ses journaux : adresse IP, page demandée, navigateur. C'est nécessaire à son fonctionnement et à sa sécurité (intérêt légitime). Ces journaux restent sur le serveur, ne sont transmis à personne et sont effacés automatiquement, au plus tard après {retention}.",
    logRetention: {
      one: "{count} semaine",
      other: "{count} semaines",
    },
    mailHeading: "Si vous m'écrivez",
    mail:
      "Ce que vous envoyez à {email} — votre adresse, votre nom, votre message — sert uniquement à vous répondre et, pour une réparation, à en assurer le suivi, à votre demande. Les messages sont reçus par la messagerie de {mailHost} ({mailCountry}), ne sont transmis à personne d'autre et sont supprimés {retention} après le dernier échange.",
    mailRetention: {
      one: "{count} mois",
      other: "{count} mois",
    },
    rightsHeading: "Vos droits",
    rights:
      "Vous pouvez demander à consulter, corriger ou effacer les données qui vous concernent, ou vous opposer à leur traitement, en écrivant à {email}. Si la réponse ne vous satisfait pas, vous pouvez introduire une réclamation auprès de l'{authority}, rue de la Presse 35, 1000 Bruxelles.",
    authority: "Autorité de protection des données",
    authorityUrl: "https://www.autoriteprotectiondonnees.be",
    contentHeading: "Contenus",
    content:
      "Sauf mention contraire, les textes, photos et vidéos de ce site sont l'œuvre de {name} ; les reproduire demande son accord. Le code du site, lui, est public : {source}.",
    sourceLink: "voir sur GitHub",
  },
};
