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
  runner GitHub Actions dans le LXC (depuis le 2026-09-30, à la place du
  webhook signé), vérification que le site sert bien la nouvelle version.
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
- Le scan de diagnostic du chapitre réparation (2026-10-01) : la couverture
  passe au scanner, une ligne brique la balaie et encadre chaque pièce réparée,
  nommée ; cadres posés dans le CMS (**Scan de diagnostic**).
- L'aperçu vidéo des stations et le suivi de mouvement du chapitre création
  (2026-10-01) : un extrait muet par projet (**Aperçu vidéo** dans le CMS),
  joué au survol ou avec le bouton Aperçu ; en création, ce qui bouge est
  teinté et encadré, calculé en direct.
- En ligne sur `https://elmzn.be` depuis le 2026-09-30 (serveur, domaine,
  `www` en 301, HSTS) ; CMS en service sur `/admin` depuis le 2026-10-01.
- Chapitre dev publié (2026-10-02) : 9 projets, couvertures en vraies images
  (captures des sites, des apps, photos), sauf l'outil de contenu IA.
- Vocabulaire (2026-10-04) : le chapitre infra s'appelle **Homelab**
  (`/fr/homelab`, les anciennes adresses `/infra` redirigent), la réparation
  **Réparation/Montage** ; le statut du bureau est « Bricoleur du numérique ».
  Grafana et Prometheus, inutilisés, quittent le schéma ; le projet
  Supervision repasse en brouillon.
- Chapitre Réparation/Montage publié (2026-10-04) : 6 projets (trois iPhone,
  deux montages PC, un carnet d'atelier), photos, scans, aperçus vidéo, et
  la vidéo du XR réparé dans son texte.
- Extraits vidéo muets dans le texte des projets ; photos et vidéos
  verticales plafonnées à 80 % de la hauteur de l'écran (2026-10-04).
- Images plus rapides (2026-10-05) : WebP seul (l'AVIF coûtait 0,5 à 0,7 s
  par image sur le serveur), un aperçu flou en attendant chaque image, et le
  cache préchauffé juste après chaque déploiement (`deploy/warm-cache.sh`,
  installé sur le serveur le 2026-10-05).
- Les koï du bureau (2026-10-05) : cinq carpes dans un bassin — un couple
  clair et sombre en yin-yang, trois plus petites sur leurs propres boucles —
  même trame 1 bit, à la place du globe (comparées sur un banc d'essai avant
  de remplacer), sur un tiers de la largeur de l'écran.
- Note de confidentialité (2026-10-05) : le courrier à `contact@elmzn.be`
  arrive chez OVHcloud, qui le fait suivre vers Gmail (Google).

## À faire — V1

- **Ancienne page d'accueil du homelab** : l'apex sert le portfolio depuis le
  2026-09-30 ; vérifier qu'elle a bien déménagé sur `home.elmzn.be` (brief,
  §16) — non vérifié depuis ce dépôt.
- **Audit de sécurité complet** (demandé le 2026-10-01) : l'application, la
  CI et le runner, le serveur, le compte GitHub — et le dépôt public
  `elmzn_homelab`, dont le README décrit tout le réseau local.
- **Boîte `contact@elmzn.be`** : redirigée par OVH (MX Plan « redirect »)
  vers la boîte Gmail depuis le 2026-10-05, testée — les premiers messages
  tombaient dans les spams (filtre Gmail « ne jamais envoyer dans le
  spam »). Reste, au choix : répondre depuis `contact@` avec un alias d'envoi
  Gmail (et Google dans le SPF du domaine). Supprimer les messages de plus
  de 12 mois, comme la note le promet.
- **Relire les mentions légales** avant la mise en ligne (orientation, pas
  avis juridique). Le jour où la réparation devient une activité rémunérée :
  l'enregistrer, puis remplir `site.repairBusiness` dans `src/site.ts` — les
  mentions et les données `LocalBusiness` de `/repair` s'adaptent d'elles-mêmes.
- **Contenu** :
  - **Création** : les 3 brouillons (animation des trajets de vol, photos de
    miniatures, vlog Malaisie) attendent leurs médias — plans du vlog, export
    de l'animation, sélection de photos. Remplir **Rôle ou intervention**,
    **Durée** et **Stack ou matériel** : c'est le générique.
  - **Dev** : une couverture pour l'outil de contenu IA (pas d'image encore).
  - **Réparation/Montage**, à confirmer ou compléter : le modèle de l'iPhone
    XR (déduit de sa couleur corail), les modèles des iPhone du carnet, les
    Ryzen exacts (les boîtes ne montrent que « 9 » et « 5 »), la carte MSI
    dépoussiérée (écrite comme la nouvelle 4060 Ti) ; et, au choix, la durée
    de chaque intervention (le ticket) et une ligne d'histoire (la panne, la
    difficulté).
  - **Homelab** : le projet Supervision revient quand la supervision tourne
    vraiment (Checkmk) — sans Grafana.
  Avant de publier une photo ou une vidéo de réparation : rien du client
  (contacts, numéros, messages, visages, lieux), métadonnées retirées.
- **Schéma du homelab** : `content/infra/network.yaml` est redessiné d'après
  `dexteee-r/elmzn_homelab` et publié (2026-10-01) ; le tenir à jour quand
  le homelab change (CMS, **Homelab**).

## À faire — plus tard

- **Objets et effets par chapitre** (proposés le 2026-09-29 d'après `../inspi/`,
  un seul effet par chapitre, dans sa seule couleur, au service du contenu) :
  - dev : ~~la disquette étiquetée et la fiche technique en tête de page
    projet~~ (fait), puis les schémas d'architecture sur grille de plan (RON) ;
  - infra : ~~le schéma réseau qui se dessine~~ (fait), puis en V3 le relief
    de points des vraies métriques et les chiffres entre crochets (DA 4) ;
  - repair : ~~la fiche d'intervention en ticket~~, ~~le scan de diagnostic
    sur la photo~~ (faits) ;
  - création : ~~la jaquette VHS en tête de page projet~~, ~~le suivi de
    mouvement sur l'aperçu vidéo, avec le curseur vidéo des stations~~ (faits) ;
    l'étagère de cassettes du chapitre lui-même (folder type › Kurosawa) reste
    une piste ; le globe des lieux de tournage est à repenser — le bureau a
    déjà le sien.
  Les objets (disquette, ticket, jaquette VHS) vont en tête des pages projet
  (choix du 2026-09-29).
- **Le bureau** : pas de police pixel (deux familles seulement) : le rendu pixel passe par
  DM Mono, l'ASCII et la trame.
- V3 : données réelles du homelab, référencement local de la réparation
  (fiche Google Business, pages par ville, avis).
- Néerlandais, quand quelqu'un peut le relire.
