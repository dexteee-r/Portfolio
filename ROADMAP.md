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

## À faire — plus tard

- **Animation en pixel art sur le côté droit du bureau, desktop uniquement**
  (demandée le 2026-09-25). Points à trancher avant de la dessiner :
  - le cadre est achromatique (règle 1) : en noir et blanc, ou seulement dans
    les couleurs des quatre marques ?
  - elle ne doit ni cacher le nom et l'activité, ni rivaliser avec la
    séquence de démarrage — elle apparaît après, ou fait partie de sa fin ?
  - desktop uniquement (≥ 768 px et pointeur fin), aucun mouvement sous
    `prefers-reduced-motion`, rien de chargé sur mobile ;
  - rendu : sprite CSS (`steps()`) ou `<canvas>` ; `image-rendering: pixelated`.
- V2 : curseur vidéo sur les stations (avec son équivalent au doigt), schéma
  réseau du homelab qui se dessine, globe pour le chapitre créatif.
- V3 : données réelles du homelab, référencement local de la réparation
  (fiche Google Business, pages par ville, avis).
- Néerlandais, quand quelqu'un peut le relire.
