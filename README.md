# ELMZN

Portfolio personnel — `elmzn.be`. Les décisions de conception sont dans
`../PROJECT_CONTEXT.md` ; ce fichier ne couvre que le code.

## Commandes

```bash
npm run dev         # serveur de développement, brouillons visibles
npm run build       # build de production, brouillons masqués
npm test            # tests unitaires et de composants (Vitest)
npm run test:e2e    # tests de bout en bout sur un build de production (Playwright + axe)
npm run check       # typecheck + lint + unitaires + e2e — à lancer avant chaque push
```

La première fois : `npx playwright install chromium`.

## Règle de travail

Chaque ajout arrive avec ses tests. La CI (`.github/workflows/ci.yml`) rejoue
toute la suite à chaque push.

## Structure

```
content/projects/*.yaml     un fichier par projet, champs traduits (édité par le CMS)
public/media/               images des projets (AVIF, WebP ou PNG — jamais de JPEG)
public/media/fixtures/      images des tests uniquement, exclues du déploiement (.vercelignore)
src/app/[locale]/           bureau, chapitres, pages projet — toutes les routes sont statiques
src/app/global-not-found.tsx  l'unique 404 du site, rendue en entier côté serveur
src/proxy.ts                redirection vers /fr sans détection de langue ; transmet la langue à la 404
src/i18n/                   langues, dictionnaires, chemins localisés
src/content/                chapitres, schéma et chargement du contenu
src/cms/                    configuration du CMS (générée depuis le schéma), connexion GitHub, page /admin
src/app/admin/              le panneau d'édition et sa copie de Sveltia CMS
src/app/api/cms/            connexion GitHub du CMS (OAuth), servie par le site lui-même
src/styles/tokens.css       source de vérité du design (la copie à la racine du dossier parent est obsolète)
src/lib/transitions.ts      les techniques de basculement, remplaçables en une ligne
src/components/ViewStage.tsx  orchestre le tiroir, le focus et la touche Échap
tests/unit/                 Vitest
tests/e2e/                  Playwright, contre tests/fixtures/content
```

## La séquence de démarrage

`src/lib/boot.ts` porte toute la chronologie (3,95 s) : le dossier se trace,
son étiquette prend quatre noms, la phrase apparaît et reste, puis le dossier
gris devient les quatre dossiers colorés, qui s'envolent se poser exactement
sur leurs marques pendant que le bureau apparaît. Pour changer le rythme, on
ne touche qu'à `bootTimeline`.

Les trois premières phases sont jouées en CSS (`globals.css`) dès le premier
affichage. La fin a besoin de la position réelle des marques : le petit
runtime `bootRuntime` — inséré tel quel dans la page comme script en ligne,
premier élément du `<body>` — la joue avec les Web Animations, déclenché par
la fin de l'animation CSS `boot-hold` (même horloge).

Ce runtime ne joue la séquence qu'au premier chargement du bureau (`/fr`,
`/en`), jamais sous `prefers-reduced-motion`, et la mémorise aussitôt
(`localStorage`, clé `elmzn.boot`). Sans JavaScript, elle n'existe pas. Une
touche, un clic, un toucher ou un défilement la passent — un clic sur un
dossier ouvre directement le chapitre ; si les animations ne tournent pas
(onglet ouvert en arrière-plan), elle s'efface après 5,95 s.

Pour la revoir : supprimer la clé `elmzn.boot` du stockage local du site, puis
recharger le bureau.

Les tests E2E partent d'un visiteur qui l'a déjà vue (`storageState` dans
`playwright.config.ts`) ; `tests/e2e/boot.spec.ts` part d'un stockage vide.

## Référencement et partage

- `src/seo/metadata.ts` : titre, description, canonical, hreflang, Open Graph
  et Twitter de chaque page, par `pageMetadata()`. Les déploiements d'aperçu
  Vercel (`VERCEL_ENV` ≠ `production`) sont en `noindex` et leur robots.txt
  ferme tout.
- `src/app/sitemap.ts`, `robots.ts`, `manifest.ts` : générés depuis le
  contenu ; seuls les projets publiés entrent dans le sitemap.
- `src/seo/structured-data.ts` : JSON-LD (`WebSite`, `Person`, fil d'Ariane,
  projets). `LocalBusiness` pour la réparation s'active dès que
  `site.repairBusiness` est rempli dans `src/site.ts`.
- Cartes de partage : `opengraph-image.tsx` à chaque niveau (bureau, chapitre,
  projet), dessinées par `src/seo/og/cards.tsx` au build, une par langue.
  Couleurs lues dans `tokens.css` (`src/seo/tokens.ts`), polices des paquets
  Fontsource (WOFF, que Satori sait lire). La taille d'un titre vient de sa
  largeur réellement mesurée dans la police (`src/seo/og/measure.ts`,
  opentype.js) : chaque mot entier sur sa ligne, trois lignes au plus. Des
  tests rendent chaque carte et vérifient, pixel par pixel, que tout tient
  dans le carré central et qu'aucun mot n'est coupé.
- Icônes : `src/app/icon.tsx` (32, 192, 512 px) et `apple-icon.tsx` (180 px),
  le dossier gris de l'intro sur le fond du cadre.

## Le tiroir

`ViewStage` enveloppe toutes les vues. Il lit les clics sur les liens au
passage (phase de capture) : aucun composant ne sait qu'une transition existe,
et le site fonctionne à l'identique sans JavaScript.

1. Clic sur un dossier : la vue courante est figée dans une copie fixe, puis la
   navigation part.
2. Le chapitre arrive dans le DOM : il est épinglé à l'écran, et
   `runTransition()` le fait monter pendant que la copie du bureau recule.
3. Fin : la copie disparaît, la vue retourne dans le flux, le focus va sur le
   titre du chapitre. Au retour (lien, logo ou Échap), le focus revient sur le
   dossier d'origine.

Garde-fous : un seul tiroir à la fois ; navigation abandonnée au bout de 8 s ;
animation terminée de force si elle n'avance pas (onglet masqué) ; aucun
mouvement sous `prefers-reduced-motion`.

À l'intérieur d'un chapitre (station ↔ page projet, projet ↔ projet), pas de
tiroir : un fondu sobre de 260 ms. Échap remonte d'un niveau — du projet au
chapitre (le focus revient sur la station d'origine), du chapitre au bureau.

La 404 globale est un document à part : ses liens sont de simples ancres
(`SiteLink plain`), sans préchargement.

## Ajouter un projet

Le plus simple : par le CMS, sur `/admin` (voir plus bas). À la main, créer
`content/projects/<slug>.yaml` — le nom du fichier devient l'URL. C'est la
forme qu'écrit le CMS : tous les champs dans `fr:`, les traductions dans `en:`.

```yaml
fr:
  title: MyTGC
  chapter: dev          # dev | infra | repair | creative
  status: draft         # draft (invisible en production) | published
  order: 1              # position dans le chapitre
  year: 2025            # facultatif
  summary: Deux ou trois lignes pour la station (280 caractères max).
  cover: /media/projects/mytgc/cover.webp   # facultatif ; le fichier doit exister
  coverAlt: Ce que montre l'image, pour qui ne la voit pas.
  links:                # facultatif ; libellés traduits par l'interface
    - kind: site        # site | repo | video | download
      url: https://…
  body: |
    Texte long de la page projet, en Markdown.
en:                     # facultatif : sans traduction complète, la version
  title: MyTGC          # française s'affiche, marquée lang="fr"
  summary: …
```

Les champs communs (`chapter`, `status`, `order`, `year`, `cover`, `links`)
sont aussi acceptés au premier niveau du fichier ; un champ facultatif vide
(`""` ou `null`) compte comme absent.

Le texte long (`body`) est du Markdown avec tableaux (GFM). Les images s'y
insèrent avec `![description](/media/projects/<slug>/capture.webp "légende")` :
elles gardent leurs proportions, passent par le pipeline d'images, et une image
seule dans son paragraphe devient une figure légendée. Le build refuse : une
image sans description, hors de `/media`, en JPEG ou distante ; un lien qui
n'est ni `http(s)`, ni `mailto:`, ni un chemin du site ; tout HTML brut.

Un projet `published` doit avoir au minimum `fr.title` et `fr.summary` (et
`fr.coverAlt` s'il a une couverture), sinon le build échoue. Une couverture qui
pointe vers un fichier absent fait aussi échouer le build. Sans couverture, la
station affiche le dossier du projet. Les compteurs du bureau ne comptent que
les projets publiés.

## Le CMS

`/admin` ouvre [Sveltia CMS](https://github.com/sveltia/sveltia-cms). Chaque
enregistrement est un commit sur la branche de production : Vercel redéploie,
et le build revalide tout le contenu — un fichier cassé fait échouer le
déploiement (et la CI), le site en ligne reste sur la version précédente.

- **Configuration** : `src/cms/config.ts`, générée depuis le schéma du contenu
  (chapitres, statuts, types de liens, limite du résumé). Des tests vérifient
  que le CMS propose exactement les champs que le build valide : un champ
  ajouté d'un côté sans l'autre fait échouer la suite.
- **Ce qu'il écrit** : `content/projects/<slug>.yaml` (la forme ci-dessus) et
  les images dans `public/media/projects/<slug>/`, noms de fichiers en
  minuscules, photos converties en WebP (2400 px max, qualité 85).
- **Sveltia** est épinglé (`package.json`, version exacte) et servi par le site
  (`/admin/sveltia-cms.js`), pas par un CDN. Il charge seulement ses polices
  depuis jsDelivr et vérifie ses mises à jour sur unpkg ; il fonctionne sans.
  Pour le mettre à jour : changer la version, `npm install`, `npm run check`
  (les tests E2E démarrent le vrai panneau et vérifient la connexion).
- **Connexion GitHub** : servie par le site lui-même, sans service tiers.
  `/api/cms/auth` envoie vers GitHub avec un `state` aléatoire gardé dans un
  cookie `HttpOnly` à usage unique ; `/api/cms/callback` le vérifie, échange le
  code contre un jeton côté serveur (le secret ne quitte jamais le serveur) et
  le remet au panneau par `postMessage`, à la seule origine du site. Le droit
  demandé à GitHub est fixé par le serveur, jamais par la requête.

### Mise en service

Le dépôt est [`dexteee-r/Portfolio`](https://github.com/dexteee-r/Portfolio),
public, branche `main`.

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App** :
   Homepage `https://elmzn.be`, callback `https://elmzn.be/api/cms/callback`.
2. Vercel → Settings → Environment Variables (Production) — valeurs dans
   `.env.example` : `CMS_GITHUB_REPO=dexteee-r/Portfolio`,
   `CMS_GITHUB_BRANCH=main`, `CMS_GITHUB_SCOPE=public_repo` (suffisant pour un
   dépôt public ; `repo` s'il devient privé), puis `CMS_GITHUB_CLIENT_ID` et
   `CMS_GITHUB_CLIENT_SECRET` de l'OAuth App.
3. Ouvrir `https://elmzn.be/admin` → **Sign In with GitHub**.

Le dépôt étant public, tout ce qui est commité se lit sur GitHub, brouillons
compris : `status: draft` cache un projet du site, pas du dépôt.

Une OAuth App n'accepte qu'une adresse de retour : la connexion GitHub ne
marche que sur `elmzn.be`. Ailleurs :

- **En local** : `npm run dev` (`.env.local` contient déjà le dépôt), puis
  `http://localhost:3000/admin` → **Work with Local Repository** (Chrome ou
  Edge) et choisir le dossier du dépôt. Les modifications sont écrites sur le
  disque, sans commit : on relit avec `npm run dev`, on commite soi-même.
- **Sur un aperçu Vercel** : **Sign In Using Access Token**, avec un jeton
  GitHub à granularité fine limité à ce dépôt (Contents : lecture/écriture).

## Garde-fous automatiques

- `tests/unit/tokens.test.ts` recalcule chaque contraste WCAG de `tokens.css`,
  vérifie que les valeurs écrites en commentaire sont exactes, et interdit aux
  composants toute couleur en dur ou toute lecture directe des variables d'un
  chapitre (seuls les alias `--chapter-*` sont permis).
- La palette par défaut de Tailwind est effacée : `text-red-500` ne génère rien.
- `tests/unit/content-projects.test.ts` valide chaque fichier du vrai dossier
  `content/` : un commit cassé depuis le CMS fait échouer la CI.
- `tests/unit/cms-config.test.ts` garde le CMS aligné sur le schéma et vérifie
  que chaque fichier de `content/` a la forme qu'écrit le CMS ;
  `tests/e2e/cms.spec.ts` démarre le vrai panneau, hors ligne, et rejoue la
  connexion avec un GitHub simulé (annulation, rappel falsifié).
- `tests/e2e/helpers.ts` détecte tout texte qui dépasse, même masqué par un
  conteneur ; bureau, 404 et chapitres sont vérifiés jusqu'à 320 px.

## À savoir

- `next start` (auto-hébergement) journalise un `NoFallbackError` pour chaque
  adresse inconnue : c'est le prix de routes 100 % statiques, qui garantissent
  une 404 complète côté serveur. Sur Vercel, ces adresses sont servies par la
  plateforme sans invoquer de fonction.
