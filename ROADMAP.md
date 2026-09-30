# Feuille de route

La liste de ce qui reste à faire. Le « pourquoi » de chaque décision est dans
`../PROJECT_CONTEXT.md` ; ici, seulement le « quoi » et l'état.

## Fait

- Fondations : langues (`/fr`, `/en`), tokens, modèle de contenu, CI.
- Bureau, chapitres et stations, pages projet, 404 globale.
- Le tiroir bureau ↔ chapitre, fondu sobre à l'intérieur d'un chapitre.
- Séquence de démarrage (3,95 s, avec la fin où les dossiers se posent).
- Référencement : métadonnées par page, hreflang, sitemap, robots (copie de
  test fermée avec `SITE_NOINDEX=1`), données structurées, emplacement
  `LocalBusiness` prévu.
- Cartes de partage générées (une par page et par langue), favicon, icône
  d'écran d'accueil, manifeste, couleur de barre du navigateur par chapitre.
- CMS Sveltia sur `/admin` : configuration générée depuis le schéma, connexion
  GitHub servie par le site, images en WebP par projet ; branché sur
  `dexteee-r/Portfolio`.
- Profil GitHub (`github.com/dexteee-r`) dans les données structurées.
- Premier push sur `dexteee-r/Portfolio` (`main`), CI verte.
- Contact en pied de chaque page (`contact@elmzn.be` en clair, Instagram,
  GitHub) ; mentions légales et note de confidentialité (`/fr/mentions-legales`,
  `/en/legal-notice`), éditeur à titre personnel (2026-09-28).
- Auto-hébergement sur le homelab au lieu de Vercel (décision du 2026-09-28) :
  image Docker construite, testée et publiée par la CI, déploiement par
  webhook signé, vérification que le site sert bien la nouvelle version.
- Geste de balayage : un chapitre tiré vers le bas au doigt, depuis le haut de
  sa page, retourne au bureau ; le tiroir reprend là où le doigt l'a lâché.
- Le tiroir ouvert : sommaire de chaque chapitre en dossiers suspendus à
  onglets (inspi : folder type › intercalaires).
- Le globe du bureau (2026-09-29) : la Terre en trame 1 bit, éclairée, à
  droite du nom, sur grand écran avec souris ; choisi sur banc d'essai parmi
  cinq pistes (globe en points, constellation, dossier 3D, portrait ASCII).
- Le schéma du homelab en tête du chapitre infra (2026-09-29) : il se dessine
  à l'écran, niveau par niveau ; édité dans le CMS, adresses IP et ports
  refusés par le build.
- La disquette du chapitre dev (2026-09-30) : en tête de page projet, le
  projet en disquette étiquetée dont le volet s'ouvre, et sa fiche technique
  (année, rôle, stack — deux nouveaux champs dans le CMS).
- Le ticket du chapitre réparation (2026-09-30) : en tête de page projet, la
  fiche d'intervention en ticket d'atelier qui s'imprime (appareil,
  intervention, durée, année — deux nouveaux champs dans le CMS).
- La jaquette VHS du chapitre création (2026-09-30) : en tête de page projet,
  la cassette dans sa jaquette qui pivote vers le lecteur, et son générique
  (année, rôle, durée, matériel — sans nouveau champ).

## À faire — V1

- **Serveur** : conteneur LXC sur srv1 (machine à choisir), Docker, webhook,
  minuteur de rattrapage, NPM pour `elmzn.be` et `deploy.elmzn.be`, secrets
  GitHub `DEPLOY_WEBHOOK_*` — pas à pas dans le README, « Hébergement ».
- **Domaine** : l'apex `elmzn.be` vers NPM ; la page d'accueil actuelle du
  homelab déménage sur `home.elmzn.be` (brief, §16).
- **Mise en service du CMS** : créer l'OAuth App GitHub et renseigner les
  variables dans `/opt/elmzn/.env` (README, « Le CMS »).
- **Boîte `contact@elmzn.be`** : le domaine reçoit bien le courrier (OVH),
  mais l'adresse n'a jamais servi — envoyer un message de test avant la mise
  en ligne. Si elle est redirigée ailleurs (Gmail…), le dire dans la note de
  confidentialité (`site.mailHost`). Supprimer les messages de plus de
  12 mois, comme la note le promet.
- **Relire les mentions légales** avant la mise en ligne (orientation, pas
  avis juridique). Le jour où la réparation devient une activité rémunérée :
  l'enregistrer, puis remplir `site.repairBusiness` dans `src/site.ts` — les
  mentions et les données `LocalBusiness` de `/repair` s'adaptent d'elles-mêmes.
- **Contenu** : les 13 projets sont en brouillon ; à rédiger et publier.
  Pour les projets dev, remplir aussi **Rôle ou intervention** et **Stack ou
  matériel** : c'est la fiche technique sous le titre. Pour les réparations,
  **Appareil**, **Rôle ou intervention** et **Durée** : c'est le ticket. Pour
  la création, **Rôle ou intervention**, **Durée** et **Stack ou matériel** :
  c'est le générique.
- **Schéma du homelab** : `content/infra/network.yaml` est un brouillon
  (machines devinées d'après le brief) ; le corriger d'après le vrai homelab,
  puis passer `status` à `published`.

## À faire — plus tard

- **Objets et effets par chapitre** (proposés le 2026-09-29 d'après `../inspi/`,
  un seul effet par chapitre, dans sa seule couleur, au service du contenu) :
  - dev : ~~la disquette étiquetée et la fiche technique en tête de page
    projet~~ (fait), puis les schémas d'architecture sur grille de plan (RON) ;
  - infra : ~~le schéma réseau qui se dessine~~ (fait), puis en V3 le relief
    de points des vraies métriques et les chiffres entre crochets (DA 4) ;
  - repair : ~~la fiche d'intervention en ticket~~ (fait), puis un scan de
    diagnostic qui nomme les pièces réparées sur la photo (animation › scan
    thermique), ramené aux tons brique — il demande des repères posés sur
    chaque photo, donc un champ de plus dans le CMS ;
  - création : ~~la jaquette VHS en tête de page projet~~ (fait), puis le
    suivi de mouvement sur l'aperçu vidéo (animation › nickjaykdesign), avec
    le curseur vidéo des stations ; l'étagère de cassettes du chapitre lui-même
    (folder type › Kurosawa) reste une piste ; le globe des lieux de tournage
    est à repenser — le bureau a déjà le sien.
  Les objets (disquette, ticket, jaquette VHS) vont en tête des pages projet
  (choix du 2026-09-29).
  Pas de police pixel (deux familles seulement) : le rendu pixel passe par
  DM Mono, l'ASCII et la trame.
- V2 : curseur vidéo sur les stations (avec son équivalent au doigt).
- V3 : données réelles du homelab, référencement local de la réparation
  (fiche Google Business, pages par ville, avis).
- Néerlandais, quand quelqu'un peut le relire.
