# ELMZN

Portfolio personnel — `elmzn.be`. Les décisions de conception sont dans
`../PROJECT_CONTEXT.md` ; ce fichier ne couvre que le code. Une décision a
changé depuis : le site est **auto-hébergé sur le homelab** (Docker), et non
sur Vercel (§10 du brief) — voir « Hébergement ».

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
content/infra/network.yaml  le schéma du homelab, dessiné en tête du chapitre infra (édité par le CMS)
public/media/               images des projets (AVIF, WebP ou PNG — jamais de JPEG)
public/media/fixtures/      images des tests uniquement, exclues de l'image Docker (.dockerignore)
src/app/[locale]/           bureau, chapitres, pages projet — toutes les routes sont statiques
src/app/[locale]/mentions-legales, legal-notice  la même page légale, un dossier par langue
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
Dockerfile                  l'image du site (serveur Next autonome), construite par la CI
deploy/                     ce qui tourne sur le serveur : compose, déploiement, rattrapage, tests de l'image
.github/workflows/           ci.yml (tests, image) sur GitHub ; deploy.yml sur le runner du homelab
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

**Le globe du bureau** (à droite, sur grand écran avec souris seulement) : la
Terre en trame 1 bit, éclairée comme le « chrome skull » du dossier
d'inspiration, qui fait un tour en 40 s, la Belgique marquée. Choisi le
2026-09-29 sur un banc d'essai, parmi un globe en points, une constellation,
un dossier 3D et un portrait ASCII.

- Rendu logiciel sans aucune couleur écrite (`src/lib/desk-art/`) : un
  tableau de gris, tramé en encre, peint dans l'encre du cadre lue sur la page.
- Chargé seulement sur grand écran avec souris : un téléphone ne télécharge
  rien. Caché pendant la séquence de démarrage puis révélé en fondu, immobile
  sous `prefers-reduced-motion`, en pause hors écran ou onglet masqué.
- Les continents viennent de Natural Earth (domaine public), échantillonnés
  une fois par `scripts/generate-land-dots.mjs` (`land-dots.json`, 25 Ko).

Les tests E2E partent d'un visiteur qui l'a déjà vue (`storageState` dans
`playwright.config.ts`) ; `tests/e2e/boot.spec.ts` part d'un stockage vide.

## Référencement et partage

- `src/seo/metadata.ts` : titre, description, canonical, hreflang, Open Graph
  et Twitter de chaque page, par `pageMetadata()`. Une copie de test du site,
  construite avec `SITE_NOINDEX=1`, est en `noindex` et son robots.txt ferme
  tout.
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

**Le tiroir ouvert** (`DrawerIndex`) : en haut de chaque chapitre, sous son
titre, les projets en dossiers suspendus côte à côte — un onglet numéroté par
dossier, décalé de gauche à droite comme des intercalaires, une bande de la
couverture, le titre sur la tranche. Sur grand écran, le dossier survolé ou
atteint au clavier s'élargit (`--duration-base`, donc instantané sous
`prefers-reduced-motion`) ; sur téléphone, le tiroir défile de côté. Le
prendre ouvre le projet (fondu sobre, même chapitre). Absent sous deux
projets : la station suffit.

**Le tiroir à la main** (écrans tactiles) : en haut d'un chapitre, on le tire
vers le bas au doigt. Il suit le doigt, le fond clair du cadre apparaît
au-dessus ; lâché après un quart de l'écran, ou d'un coup sec, le tiroir
reprend de là jusqu'au bureau (dans le temps qui reste), sinon le chapitre
remonte. Les règles sont dans `src/lib/pull.ts` (logique pure) et le
branchement dans `ViewStage` :

- il ne démarre qu'en haut de page — plus bas, tirer vers le bas, c'est
  remonter la page ; rien n'est décidé avant 10 px — un tap reste un tap ;
- un geste vers le haut ou de côté est laissé au navigateur jusqu'au bout ;
- sur un chapitre, `overscroll-behavior-y: none` coupe le « tirer pour
  rafraîchir » du navigateur ;
- les pages projet et le bureau ne se tirent pas ; l'indice « ou tirer vers le
  bas » remplace « Échap » dans le pied de page sur écran tactile.

`tests/e2e/pull.spec.ts` rejoue le geste avec de vrais événements tactiles
(protocole DevTools), défilement natif compris.

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
  chapter: dev          # dev | infra (le Homelab, /fr/homelab) | repair | creative
  status: draft         # draft (invisible en production) | published
  order: 1              # position dans le chapitre
  year: 2025            # facultatif
  summary: Deux ou trois lignes pour la station (280 caractères max).
  cover: /media/projects/mytgc/cover.webp   # facultatif ; le fichier doit exister
  preview: /media/projects/mytgc/preview.mp4   # facultatif ; extrait muet, 4 Mo max, couverture obligatoire
  coverAlt: Ce que montre l'image, pour qui ne la voit pas.
  links:                # facultatif ; libellés traduits par l'interface
    - kind: site        # site | repo | video | download
      url: https://…
  stack:                # facultatif ; 8 noms au plus, jamais traduits (dev : technologies ; création : matériel)
    - Next.js
    - PostgreSQL
  role: Conception et développement   # facultatif ; une ligne (80 caractères)
  device: iPhone 16 Pro Max   # réparation, facultatif ; jamais traduit
  duration: 150         # réparation ou création, facultatif ; en minutes (→ « 2 h 30 »)
  body: |
    Texte long de la page projet, en Markdown.
en:                     # facultatif : sans traduction complète, la version
  title: MyTGC          # française s'affiche, marquée lang="fr"
  summary: …
  role: Design and development   # sans elle, le rôle français, marqué lang="fr"
```

Les champs communs (`chapter`, `status`, `order`, `year`, `cover`, `links`,
`stack`, `device`, `duration`) sont aussi acceptés au premier niveau du
fichier ; un champ facultatif vide (`""` ou `null`) compte comme absent.

**La disquette du chapitre dev.** En tête de chaque page projet dev, le projet
est une disquette 3,5" étiquetée (inspi : folder type › floppy disk mockups) :
son titre, son rang dans le chapitre (`01/04`), son année et un code-barres
tiré de son slug. Son volet s'ouvre une fois, quand la page apparaît — la
disquette est lue ; sans animation, il est simplement ouvert. Elle est
décorative (tout ce qu'elle porte est déjà sur la page), donc cachée aux
lecteurs d'écran. À côté, la **fiche technique** (inspi : DA 2) : année, rôle
et stack, en vrai texte, seulement les lignes remplies — rien à dire, pas de
fiche. La stack sert aussi de mots-clés dans les données structurées. Les
projets infra gardent cette fiche seule, sous leur titre : l'effet du chapitre
infra, c'est le schéma du homelab.

**Le ticket du chapitre réparation.** En tête de chaque page projet
réparation, la **fiche d'intervention** en ticket d'atelier (inspi : DA 2 ›
ticket), sur le papier du chapitre : son numéro (le rang dans le chapitre),
l'appareil en grand et en brique, puis l'intervention (le champ `role`), la
durée et l'année ; une ligne de découpe, le code-barres. C'est du vrai texte :
seul le décor est caché aux lecteurs d'écran. Il sort de sa fente par à-coups,
comme d'une imprimante thermique, une fois la page apparue ; sans animation, il
y pend simplement. Sans rien à imprimer (ni appareil, ni intervention, ni
durée, ni année), pas de ticket. L'appareil est aussi le premier mot-clé des
données structurées.

**Le scan de diagnostic.** Sur une page réparation, la photo de couverture
passe au scanner (inspi : animation › scan thermique, ramené à la brique) :
coins de viseur, puis, quand la photo entre à l'écran, une ligne balaie de
haut en bas et chaque pièce réparée qu'elle croise se verrouille dans un
cadre numéroté et nommé. Sans JavaScript ou avec les animations réduites, les
cadres sont simplement là. Les pièces sont aussi dites en toutes lettres aux
lecteurs d'écran. Les cadres se posent dans le CMS (**Scan de diagnostic**),
en % de la photo depuis son coin haut gauche — la photo s'affiche alors dans
ses propres proportions, pour que les cadres tombent juste :

```yaml
fr:
  scan:                 # 6 pièces au plus ; le build refuse un cadre qui sort de la photo
    - label: Vitre arrière
      x: 10             # depuis la gauche
      y: 20             # depuis le haut
      w: 40             # largeur
      h: 50             # hauteur
en:
  scan:                 # les mêmes cadres (le CMS les recopie), les noms traduits ;
    - label: Back glass # sans liste anglaise, la française, marquée lang="fr"
      x: 10
      y: 20
      w: 40
      h: 50
```

Un scan exige une couverture : sans elle, le build échoue.

**La jaquette VHS du chapitre création.** En tête de chaque page projet
création, le projet est une cassette VHS dans sa jaquette ambre (inspi : folder
type › Kurosawa) : la tranche porte le titre — de bas en haut en français, de
haut en bas en anglais, comme sur les étagères de chaque langue —, la face le
format (VHS, PAL), la couverture derrière des lignes de balayage (un coucher de
soleil rayé sans couverture), le titre, l'année et la durée. Elle pivote une
fois vers le lecteur, comme une cassette tirée de l'étagère ; sans animation,
elle lui fait simplement face. Décorative, comme la disquette. Sa couverture
demande le même `sizes` que celle de la page : le navigateur ne télécharge
qu'un fichier pour les deux. À côté, le **générique** : la fiche technique du
dev, avec les mots du cinéma — année, rôle, durée, matériel.

**L'aperçu vidéo des stations, et son suivi de mouvement.** Un projet peut
avoir un aperçu (`preview`) : un extrait muet de quelques secondes, en MP4
(H.264, lu partout), 4 Mo au plus, sa couverture servant d'image d'attente.
Sur la station, il prend la place de l'image : au survol avec une souris, ou
avec le bouton **Aperçu** — au doigt, au clavier. Il ne se lance jamais seul
sur un téléphone, ni au survol avec les animations réduites ; il ne se
télécharge qu'au premier lancement et s'arrête hors de l'écran. Dans le
chapitre création, un suivi de mouvement s'y superpose (inspi : animation ›
nickjaykdesign) : calculé en direct à partir des images de la vidéo
(`src/lib/motion.ts`, 15 fois par seconde sur une version de 64 pixels de
large), il teinte d'ambre ce qui bouge et l'encadre, chaque cadre avec la part
de ses pixels qui a bougé. Pour préparer un extrait :
`ffmpeg -i source.mov -t 6 -an -vf scale=1280:-2 -c:v libx264 -crf 28 -movflags +faststart preview.mp4`.

Le texte long (`body`) est du Markdown avec tableaux (GFM). Les images s'y
insèrent avec `![description](/media/projects/<slug>/capture.webp "légende")` :
elles gardent leurs proportions, passent par le pipeline d'images, et une image
seule dans son paragraphe devient une figure légendée. Le build refuse : une
image sans description, hors de `/media`, en JPEG ou distante ; un lien qui
n'est ni `http(s)`, ni `mailto:`, ni un chemin du site ; tout HTML brut.

Un **extrait vidéo** s'insère de la même façon, en `.mp4` ou `.webm` :
`![description](/media/projects/<slug>/apres.mp4 "légende")`. Il est muet,
avec ses contrôles, et ne se lance jamais seul. Son image d'attente est le
`.webp` du même nom, posé à côté (`apres.webp`) : elle s'affiche jusqu'à la
lecture et donne ses proportions à l'extrait, pour que la page ne bouge pas au
chargement. Le build échoue sans elle, sans l'extrait, ou si l'extrait dépasse
4 Mo. Avant de publier un extrait de réparation, vérifier image par image
qu'il ne montre rien du client : contacts, numéros, messages, visages.

Un projet `published` doit avoir au minimum `fr.title` et `fr.summary` (et
`fr.coverAlt` s'il a une couverture), sinon le build échoue. Une couverture qui
pointe vers un fichier absent fait aussi échouer le build. Sans couverture, la
station affiche le dossier du projet. Les compteurs du bureau ne comptent que
les projets publiés.

L'infra ne se photographie pas : les couvertures de ses projets sont
**dessinées** par `scripts/generate-infra-covers.mjs`, dans la palette du
chapitre (lue dans `tokens.css`), d'après la documentation du homelab — les
trois machines, un tableau de bord sans chiffres, le tunnel du VPN. Après une
retouche : `node scripts/generate-infra-covers.mjs`, vérifier, commiter les
WebP. Les autres chapitres attendent de vraies images : captures d'apps en
situation, photos avant / pendant / après, plans de tournage.

## Le schéma du homelab

En tête du chapitre infra, le homelab se dessine quand il entre à l'écran :
les liaisons se tracent niveau par niveau, depuis Internet, et chaque machine
s'allume avec ses repères (inspi : animation › Hyperspace tracking). Sur grand
écran, un arbre tant qu'il tient en cinq colonnes ; au-delà, l'arbre s'arrête au
niveau le plus profond qui tient — les machines — et tout ce qu'elles hébergent
est listé sous elles, en arborescence (`layoutHybrid`). Sur téléphone, une
arborescence de fichiers ; pour un lecteur d'écran, une liste imbriquée. Sans
JavaScript ou avec les animations réduites, il est dessiné d'emblée.

Tout vient de `content/infra/network.yaml`, éditable dans le CMS
(**Homelab › Schéma réseau (chapitre infra)**) :

```yaml
status: draft           # draft : le schéma ne s'affiche qu'en développement
nodes:                  # dans l'ordre de lecture, 24 au maximum
  - id: internet        # minuscules et tirets, unique
    label: Internet     # 32 caractères au maximum
    kind: internet      # internet | router | proxy | hypervisor | nas | vm | container | service
  - id: box
    label: Box
    kind: router
    parent: internet    # un seul nœud sans parent : la racine
```

Le schéma est **public** : le build refuse toute adresse IP (v4 ou v6) et tout
port (`:8080`) dans un libellé ou un identifiant. Il refuse aussi un arbre
cassé : plusieurs racines, un parent inconnu, une boucle, un identifiant en
double. Le fichier actuel est tiré du dépôt du homelab
([`dexteee-r/elmzn_homelab`](https://github.com/dexteee-r/elmzn_homelab)) : les
trois machines et ce qui tourne aujourd'hui, rien d'arrêté ni d'encore en
configuration, aucun nom de domaine réservé au réseau local. Publié le
2026-10-01.

## Contact et mentions légales

- **Contact** : le pied de page de chaque vue (`SiteFooter`) donne l'adresse
  `site.email` en clair et cliquable, dans le HTML du serveur (ni formulaire,
  ni script qui la masque), les profils de `site.social` et le lien vers les
  mentions légales. On peut y renvoyer directement : `elmzn.be/fr#contact`.
- **Mentions légales et confidentialité** : `/fr/mentions-legales`,
  `/en/legal-notice` (`LegalView`), une page du cadre comme le bureau. Tout
  vient de `src/site.ts` : l'éditeur (`publisher`, personne privée pour
  l'instant), l'hébergeur (`hosting`), la messagerie (`mailHost`), la durée de
  conservation des e-mails (`emailRetentionMonths`) et la date de révision
  (`legalUpdated`, à changer à chaque modification du texte). Le jour où la
  réparation est enregistrée, remplir `site.repairBusiness` (avec son numéro
  BCE) : l'entreprise apparaît dans les mentions et dans les données
  structurées de `/repair`, et la phrase « à titre privé » disparaît.
- **Adresses par langue** : chaque page du cadre a un dossier de route par
  slug (`src/content/pages.ts`). Next ne sait pas limiter un dossier statique
  à une langue : `/en/mentions-legales` redirige donc (308) vers
  `/en/legal-notice`, par les redirections de `next.config.ts` générées depuis
  la même liste.
- **Promesses tenues par des tests** : `tests/unit/privacy-claims.test.ts`
  échoue si le code se met à stocker autre chose que `elmzn.boot` dans le
  navigateur, pose un cookie ailleurs que dans la connexion du CMS, ou charge
  un outil de mesure d'audience. Ajouter Umami ou Plausible demandera donc de
  réécrire la note de confidentialité en même temps.

Ces textes sont une orientation, pas un avis juridique : à faire relire.

## Le CMS

`/admin` ouvre [Sveltia CMS](https://github.com/sveltia/sveltia-cms). Chaque
enregistrement est un commit sur `main` : la CI revalide tout le contenu, puis
construit et déploie le site (voir « Hébergement ») — un fichier cassé fait
échouer la CI, et le site en ligne reste sur la version précédente.

- **Configuration** : `src/cms/config.ts`, générée depuis le schéma du contenu
  (chapitres, statuts, types de liens, limite du résumé). Des tests vérifient
  que le CMS propose exactement les champs que le build valide : un champ
  ajouté d'un côté sans l'autre fait échouer la suite.
- **Ce qu'il écrit** : `content/projects/<slug>.yaml` (la forme ci-dessus),
  `content/infra/network.yaml` (le schéma du homelab) et
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
2. Sur le serveur, dans `/opt/elmzn/.env` (voir « Hébergement ») — valeurs
   dans `.env.example` : `CMS_GITHUB_REPO=dexteee-r/Portfolio`,
   `CMS_GITHUB_BRANCH=main`, `CMS_GITHUB_SCOPE=public_repo` (suffisant pour un
   dépôt public ; `repo` s'il devient privé), puis `CMS_GITHUB_CLIENT_ID` et
   `CMS_GITHUB_CLIENT_SECRET` de l'OAuth App. Puis `docker compose up -d`.
3. Ouvrir `https://elmzn.be/admin` → **Sign In with GitHub**.

Le dépôt étant public, tout ce qui est commité se lit sur GitHub, brouillons
compris : `status: draft` cache un projet du site, pas du dépôt.

Une OAuth App n'accepte qu'une adresse de retour : la connexion GitHub ne
marche que sur `elmzn.be`. Ailleurs :

- **En local** : `npm run dev` (`.env.local` contient déjà le dépôt), puis
  `http://localhost:3000/admin` → **Work with Local Repository** (Chrome ou
  Edge) et choisir le dossier du dépôt. Les modifications sont écrites sur le
  disque, sans commit : on relit avec `npm run dev`, on commite soi-même.
- **Sur une copie de test** : **Sign In Using Access Token**, avec un jeton
  GitHub à granularité fine limité à ce dépôt (Contents : lecture/écriture).

Derrière Nginx Proxy Manager, le serveur ne voit que sa propre adresse
(`0.0.0.0:3000`) : l'adresse publique vient des en-têtes `Host` et
`X-Forwarded-Proto` que NPM transmet (`src/lib/public-origin.ts`). Sans eux,
GitHub refuserait la connexion — le test de l'image le vérifie.

## Hébergement

Le site tourne sur le homelab, dans Docker, derrière Nginx Proxy Manager. Le
déploiement passe par un runner GitHub Actions installé dans le LXC du site
(comme Watchlist) :

```
push sur main (ou enregistrement dans le CMS)
  → CI (GitHub) : typecheck, lint, unitaires, E2E
  → CI : construit l'image, la teste comme le serveur la lance (deploy/smoke-test.sh)
  → CI : la publie sur ghcr.io/dexteee-r/portfolio (:latest et :<commit>)
  → Deploy (runner du homelab) : deploy.sh tire l'image, relance le site s'il a changé, attend qu'il soit sain
  → Deploy : vérifie que le site sert ce commit (en-tête X-Elmzn-Version) — sinon, rouge
```

Rien n'est ouvert sur Internet à part le site : pas de webhook, pas de
sous-domaine de déploiement, aucun secret de déploiement dans GitHub. Un
minuteur horaire sur le serveur rattrape un déploiement manqué. Tant que la
variable de dépôt `DEPLOY_ON_HOMELAB` n'est pas à `true`, le déploiement est
simplement sauté : l'image est publiée, rien n'est déployé.

**Le dépôt est public : un runner auto-hébergé ne doit jamais exécuter le
code d'une pull request.** N'importe qui peut forker le dépôt et proposer un
workflow qui viserait ce runner ; son code tournerait dans le LXC, avec les
droits de Docker (autant dire root) et l'accès au `.env`. D'où trois verrous :

- `.github/workflows/deploy.yml` ne part que d'un passage réussi de la CI pour
  un push sur `main` de ce dépôt — jamais une pull request, jamais un fork —,
  sans jeton, sans rien extraire du dépôt : il lance `deploy.sh` et vérifie la
  version, rien d'autre ;
- `tests/unit/deploy.test.ts` échoue si un autre workflow vise le runner ;
- **réglage GitHub, obligatoire avant d'installer le runner** : Settings →
  Actions → General → *Approval for running fork pull request workflows from
  contributors* → **Require approval for all external contributors**. Les
  workflows d'une pull request extérieure attendent alors ton approbation :
  ne l'accorder qu'après avoir lu leurs fichiers `.github/workflows/`.

### Mise en place du serveur

Sur srv1, un conteneur LXC Debian 12 dédié (Proxmox : cocher *nesting* et
*keyctl* pour Docker).

1. **Docker** : installer Docker Engine et le plugin Compose (dépôt officiel
   Docker pour Debian).
2. **L'utilisateur du runner** : `adduser --disabled-password github-runner`
   puis `usermod -aG docker github-runner` (le nom importe peu ; il doit
   seulement pouvoir lancer Docker et lire `/opt/elmzn`).
3. **Le site** : créer `/opt/elmzn/`, y copier `deploy/compose.yaml`,
   `deploy/deploy.sh`, `deploy/wait-for-version.sh` et `deploy/warm-cache.sh`
   (`chmod +x` sur les trois scripts), et un `.env` (`chmod 600`) avec les
   variables `CMS_GITHUB_*` (voir « Le CMS ») ; puis
   `chown -R github-runner: /opt/elmzn`. `warm-cache.sh` remplit le cache des
   images optimisées juste après chaque déploiement (ce cache vit en mémoire
   et chaque redémarrage le vide) : sans lui, chaque image est fabriquée à la
   première visite. Absent, le déploiement passe quand même, avec un
   avertissement.
4. **L'image** : le paquet `ghcr.io/dexteee-r/portfolio` est public. Lancer
   une première fois `sudo -u github-runner /opt/elmzn/deploy.sh`.
5. **Le réglage GitHub** ci-dessus (approbation de tous les contributeurs
   externes), avant tout le reste.
6. **Le runner** : GitHub → Settings → Actions → Runners → *New self-hosted
   runner* (Linux x64). En tant que `github-runner`, dans
   `~/actions-runner`, télécharger l'archive indiquée, puis
   `./config.sh --url https://github.com/dexteee-r/Portfolio --token <jeton affiché> --labels portfolio --name elmzn --unattended`,
   et en root `./svc.sh install github-runner && ./svc.sh start`.
7. **L'interrupteur** : GitHub → Settings → Secrets and variables → Actions →
   *Variables* → `DEPLOY_ON_HOMELAB` = `true`. Le prochain push sur `main` se
   déploie.
8. **Le rattrapage** : copier `deploy/elmzn-deploy.service` et `.timer` dans
   `/etc/systemd/system/`, puis `systemctl enable --now elmzn-deploy.timer`
   (il tourne en root ; `deploy.sh` se verrouille sur lui-même en lecture, le
   runner et le minuteur ne se marchent donc jamais dessus).
9. **Nginx Proxy Manager** :
   - `elmzn.be` → `http://<ip du LXC>:3000`, certificat Let's Encrypt,
     *Force SSL*, *HTTP/2*, *HSTS*. NPM transmet `Host` et
     `X-Forwarded-Proto` par défaut : ne pas les retirer.
   - `www.elmzn.be` → *Redirection Host* en 301 vers `https://elmzn.be`, en
     gardant le chemin, avec son propre certificat. Pas un proxy vers le site :
     la connexion GitHub du CMS construit son adresse de retour depuis `Host`,
     et l'OAuth App n'accepte que `elmzn.be` ; le site serait aussi servi en
     double.

Pour vérifier l'image sans GitHub, avec Docker en local :
`docker build --build-arg ELMZN_VERSION=local -t elmzn:local .` puis
`sh deploy/smoke-test.sh elmzn:local local`.

Les journaux d'accès de NPM gardent l'adresse IP des visiteurs : la note de
confidentialité promet qu'ils disparaissent au plus tard après 11 semaines
(rotation par défaut de NPM). Changer la rotation, c'est changer
`site.serverLogRetentionWeeks` en même temps.

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
- `tests/unit/deploy.test.ts` vérifie l'image (utilisateur non root, aucun
  secret, contrôle de santé), le verrouillage du conteneur, l'enchaînement de
  la CI et du déploiement — le runner du homelab n'est joignable que par
  `deploy.yml`, pour un push sur `main` de ce dépôt, sans jeton ni code du
  dépôt —, et exécute réellement `deploy.sh`, `wait-for-version.sh` et
  `warm-cache.sh` contre de faux `docker` et `curl`.
- `deploy/smoke-test.sh` lance l'image en lecture seule, sans privilèges,
  derrière un faux proxy HTTPS, et contrôle pages, 404, redirections, images,
  CMS et connexion GitHub avant toute publication.

## À savoir

- Le serveur journalise un `NoFallbackError` pour chaque adresse inconnue :
  c'est le prix de routes 100 % statiques, qui garantissent une 404 complète
  côté serveur. Du bruit, pas une panne ; les journaux du conteneur sont
  plafonnés à 30 Mo (`deploy/compose.yaml`).
- Les E2E tournent sur `next start` (sortie Next classique) ; l'image, elle,
  embarque la sortie *standalone*, vérifiée par `deploy/smoke-test.sh`.
