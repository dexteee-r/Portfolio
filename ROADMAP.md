# Feuille de route

La liste de ce qui reste à faire. Le « pourquoi » de chaque décision est dans
`../PROJECT_CONTEXT.md` ; ici, seulement le « quoi » et l'état.

## Fait

- Fondations : langues (`/fr`, `/en`), tokens, modèle de contenu, CI.
- Bureau, chapitres et stations, pages projet, 404 globale.
- Le tiroir bureau ↔ chapitre, fondu sobre à l'intérieur d'un chapitre.
- Séquence de démarrage (3,95 s, avec la fin où les dossiers se posent).
- Référencement : métadonnées par page, hreflang, sitemap, robots (aperçus
  Vercel fermés), données structurées, emplacement `LocalBusiness` prévu.
- Cartes de partage générées (une par page et par langue), favicon, icône
  d'écran d'accueil, manifeste, couleur de barre du navigateur par chapitre.
- CMS Sveltia sur `/admin` : configuration générée depuis le schéma, connexion
  GitHub servie par le site, images en WebP par projet ; branché sur
  `dexteee-r/Portfolio`.
- Profil GitHub (`github.com/dexteee-r`) dans les données structurées.

## À faire — V1

- **Mise en ligne** : premier push sur `dexteee-r/Portfolio` (`main`), projet
  Vercel relié au dépôt, domaine `elmzn.be`.
- **Mise en service du CMS** : créer l'OAuth App GitHub et renseigner les
  variables sur Vercel (README, « Le CMS »).
- **Contact** : `contact@elmzn.be` en clair, Instagram, GitHub. Pas de
  formulaire en V1.
- **Mentions légales** et note de confidentialité — à faire valider avant la
  mise en ligne (statut de l'activité de réparation). Une fois l'activité
  enregistrée, remplir `site.repairBusiness` dans `src/site.ts` : les données
  `LocalBusiness` de `/repair` s'activent d'elles-mêmes.
- **Geste de balayage** : fermer un chapitre en le tirant vers le bas au doigt.
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
