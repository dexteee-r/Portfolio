import type { CmsConfig } from "@sveltia/cms";
import { chapterIds } from "@/content/chapters";
import { LABEL_MAX_LENGTH, NETWORK_FILE, NETWORK_MAX_NODES, networkKinds } from "@/content/network";
import {
  DEVICE_MAX_LENGTH,
  DURATION_MAX_MINUTES,
  linkKinds,
  PREVIEW_MAX_BYTES,
  projectStatuses,
  ROLE_MAX_LENGTH,
  SCAN_LABEL_MAX_LENGTH,
  SCAN_MAX_MARKERS,
  STACK_ITEM_MAX_LENGTH,
  STACK_MAX_ITEMS,
  SUMMARY_MAX_LENGTH,
} from "@/content/schema";
import { SLUG_PATTERN } from "@/content/slug";
import { defaultLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { site } from "@/site";

/**
 * Sveltia CMS configuration, generated from the content schema rather than
 * written by hand: the chapters, statuses, link kinds, summary length and
 * languages the editor offers are the very ones the build validates. The CMS
 * and the site cannot drift apart.
 */

export interface CmsSettings {
  /** GitHub repository, `owner/name`. */
  repo: string;
  branch: string;
  /** Origin serving the OAuth endpoints (this site). */
  baseUrl: string;
  /** `public_repo` suffices for a public repository; `repo` for a private one. */
  scope: "repo" | "public_repo";
}

/** Where the OAuth endpoints live, relative to `baseUrl`. */
export const CMS_AUTH_ENDPOINT = "api/cms/auth";

/** Every project in its own media folder: two `cover.jpg` never overwrite each other. */
export const PROJECT_MEDIA_FOLDER = "/public/media/projects/{{slug}}";
export const PROJECT_PUBLIC_FOLDER = "/media/projects/{{slug}}";

const STATUS_LABELS: Record<(typeof projectStatuses)[number], string> = {
  draft: "Brouillon — invisible sur le site en ligne",
  published: "Publié",
};

const LINK_LABELS: Record<(typeof linkKinds)[number], string> = {
  site: "Site",
  repo: "Code source",
  video: "Vidéo",
  download: "Téléchargement",
};

export function cmsConfig(settings: CmsSettings): CmsConfig {
  const fr = getDictionary(defaultLocale);

  return {
    load_config_file: false,
    app_title: `${site.brand} — contenu`,
    site_url: site.url,
    display_url: site.url,
    backend: {
      name: "github",
      repo: settings.repo,
      branch: settings.branch,
      base_url: settings.baseUrl,
      auth_endpoint: CMS_AUTH_ENDPOINT,
      auth_scope: settings.scope,
    },
    media_folder: "public/media",
    public_folder: "/media",
    media_libraries: {
      default: {
        config: {
          // `IMG_1234.JPG` → `img-1234.webp`: lowercase, no JPEG, as the build requires.
          slugify_filename: true,
          max_file_size: 25_000_000,
          transformations: {
            raster_image: { format: "webp", quality: 85, width: 2400, height: 2400 },
          },
        },
      },
    },
    // File names become URLs: ASCII, no accents, hyphens — the build's slug rule.
    slug: { encoding: "ascii", clean_accents: true, sanitize_replacement: "-" },
    // An empty optional field is left out rather than written as "" or null.
    output: { omit_empty_optional_fields: true },
    i18n: {
      // One file per project, every language inside it, fields under each locale key.
      structure: "single_file",
      locales: [...locales],
      default_locale: defaultLocale,
    },
    collections: [
      {
        name: "projects",
        label: "Projets",
        label_singular: "Projet",
        description:
          "Un fichier par projet. Un brouillon n'apparaît que sur l'aperçu ; « Publié » le met en ligne au prochain déploiement.",
        folder: "content/projects",
        format: "yaml",
        extension: "yaml",
        create: true,
        delete: true,
        i18n: true,
        identifier_field: "title",
        slug: "{{slug}}",
        summary: "{{title}} — {{chapter}} · {{status}}",
        sortable_fields: ["chapter", "order", "title"],
        view_groups: [{ name: "chapter", label: "Chapitre", field: "chapter" }],
        view_filters: projectStatuses.map((status) => ({
          name: status,
          label: STATUS_LABELS[status],
          field: "status",
          pattern: status,
        })),
        media_folder: PROJECT_MEDIA_FOLDER,
        public_folder: PROJECT_PUBLIC_FOLDER,
        fields: [
          {
            name: "title",
            label: "Titre",
            widget: "string",
            i18n: true,
            required: [defaultLocale],
            hint: "Le nom du projet. Il donne aussi l'adresse de la page à la création.",
          },
          {
            name: "chapter",
            label: "Chapitre",
            widget: "select",
            i18n: false,
            options: chapterIds.map((id) => ({ label: fr.chapters[id].name, value: id })),
          },
          {
            name: "status",
            label: "Statut",
            widget: "select",
            i18n: false,
            default: "draft",
            options: projectStatuses.map((status) => ({ label: STATUS_LABELS[status], value: status })),
          },
          {
            name: "order",
            label: "Ordre dans le chapitre",
            widget: "number",
            i18n: false,
            value_type: "int",
            min: 0,
            default: 100,
            hint: "Les plus petits nombres viennent en premier.",
          },
          {
            name: "year",
            label: "Année",
            widget: "number",
            i18n: false,
            required: false,
            value_type: "int",
            min: 2000,
            max: 2100,
          },
          {
            name: "role",
            label: "Rôle ou intervention",
            widget: "string",
            i18n: true,
            required: false,
            maxlength: ROLE_MAX_LENGTH,
            hint: "Ce qui a été fait, en quelques mots. Dev : le rôle (« Conception et développement »), dans la fiche technique. Réparation : l'intervention (« Remplacement de la vitre arrière »), sur le ticket. Création : le rôle (« Réalisation et montage »), dans le générique.",
          },
          {
            name: "device",
            label: "Appareil",
            widget: "string",
            i18n: false,
            required: false,
            maxlength: DEVICE_MAX_LENGTH,
            hint: "Réparation : l'appareil, par son nom commercial (iPhone 16 Pro Max). En gros sur le ticket.",
          },
          {
            name: "duration",
            label: "Durée (minutes)",
            widget: "number",
            i18n: false,
            required: false,
            value_type: "int",
            min: 1,
            max: DURATION_MAX_MINUTES,
            hint: "Réparation : le temps de l'intervention. Création : la durée de la vidéo. En minutes, affiché en heures au besoin (150 → 2 h 30).",
          },
          {
            name: "stack",
            label: "Stack ou matériel",
            label_singular: "Technologie",
            widget: "list",
            i18n: false,
            required: false,
            max: STACK_MAX_ITEMS,
            field: {
              name: "name",
              label: "Nom",
              widget: "string",
              maxlength: STACK_ITEM_MAX_LENGTH,
            },
            hint: "Chaque nom tel quel, jamais traduit. Dev : les technologies (Next.js, PostgreSQL, Docker), dans la fiche technique. Création : le matériel et les logiciels (Sony A7 IV, DaVinci Resolve), dans le générique.",
          },
          {
            name: "summary",
            label: "Résumé",
            widget: "text",
            i18n: true,
            required: [defaultLocale],
            maxlength: SUMMARY_MAX_LENGTH,
            hint: "Deux ou trois lignes pour la station du chapitre. Assez pour donner envie, pas assez pour tout dire.",
          },
          {
            name: "cover",
            label: "Image de couverture",
            widget: "image",
            i18n: false,
            required: false,
            hint: "L'image forte de la station. Convertie en WebP à l'envoi.",
          },
          {
            name: "preview",
            label: "Aperçu vidéo",
            widget: "file",
            i18n: false,
            required: false,
            accept: "video/mp4,video/webm",
            hint: `Un extrait muet de quelques secondes (MP4 en H.264, ${PREVIEW_MAX_BYTES / 1024 / 1024} Mo au plus), joué sur la station au survol ou avec le bouton Aperçu ; l'image de couverture, obligatoire, reste l'image d'attente. Dans le chapitre création, un suivi de mouvement s'y superpose.`,
          },
          {
            name: "coverAlt",
            label: "Description de l'image",
            widget: "string",
            i18n: true,
            required: false,
            hint: "Ce que montre l'image, pour qui ne la voit pas. Obligatoire dès qu'une image est choisie.",
          },
          {
            name: "scan",
            label: "Scan de diagnostic",
            label_singular: "Pièce",
            widget: "list",
            i18n: true,
            required: false,
            max: SCAN_MAX_MARKERS,
            summary: "{{label}} — {{x}} %, {{y}} %",
            hint: "Réparation : les pièces réparées, encadrées sur la photo de couverture. Chaque cadre en % de la photo, depuis son coin haut gauche ; les positions sont reprises dans chaque langue, seul le nom se traduit.",
            fields: [
              { name: "label", label: "Pièce", widget: "string", i18n: true, maxlength: SCAN_LABEL_MAX_LENGTH },
              ...(
                [
                  ["x", "Depuis la gauche (%)"],
                  ["y", "Depuis le haut (%)"],
                  ["w", "Largeur (%)"],
                  ["h", "Hauteur (%)"],
                ] as const
              ).map(([name, label]) => ({
                name,
                label,
                widget: "number" as const,
                i18n: "duplicate" as const,
                value_type: "float" as const,
                min: 0,
                max: 100,
              })),
            ],
          },
          {
            name: "links",
            label: "Liens",
            label_singular: "Lien",
            widget: "list",
            i18n: false,
            required: false,
            summary: "{{kind}} — {{url}}",
            fields: [
              {
                name: "kind",
                label: "Type",
                widget: "select",
                options: linkKinds.map((kind) => ({ label: LINK_LABELS[kind], value: kind })),
              },
              {
                name: "url",
                label: "Adresse",
                widget: "string",
                pattern: ["^https?://", "Une adresse web complète, commençant par https://"],
              },
            ],
          },
          {
            name: "body",
            label: "Texte long",
            widget: "markdown",
            i18n: true,
            required: false,
            // Nothing that would produce raw HTML, which the build refuses.
            buttons: [
              "bold",
              "italic",
              "link",
              "heading-two",
              "heading-three",
              "quote",
              "bulleted-list",
              "numbered-list",
              "code",
            ],
            editor_components: ["image", "code-block"],
            hint: "La page projet : le contexte, les choix, ce qui a coincé. Chaque image doit avoir une description.",
          },
        ],
      },
      {
        name: "homelab",
        label: "Homelab",
        description: "Le schéma réseau dessiné en tête du chapitre Homelab.",
        files: [
          {
            name: "network",
            label: "Schéma réseau (chapitre Homelab)",
            file: `content/${NETWORK_FILE.split(/[\\/]/).join("/")}`,
            format: "yaml",
            fields: [
              {
                name: "status",
                label: "Statut",
                widget: "select",
                options: projectStatuses.map((status) => ({ label: STATUS_LABELS[status], value: status })),
                default: "draft",
                hint: "Un brouillon n'apparaît que sur l'aperçu : publie le schéma une fois qu'il est juste.",
              },
              {
                name: "nodes",
                label: "Machines et services",
                label_singular: "Machine ou service",
                widget: "list",
                min: 1,
                max: NETWORK_MAX_NODES,
                summary: "{{fields.label}} — {{fields.kind}}",
                fields: [
                  {
                    name: "id",
                    label: "Identifiant",
                    widget: "string",
                    pattern: [SLUG_PATTERN.source, "Minuscules, chiffres et tirets simples"],
                    hint: "Un nom court et unique, repris dans « Hébergé par » des machines qui en dépendent.",
                  },
                  {
                    name: "label",
                    label: "Nom affiché",
                    widget: "string",
                    maxlength: LABEL_MAX_LENGTH,
                    hint: "Jamais d'adresse IP ni de port : le site est public, le build les refuse.",
                  },
                  {
                    name: "kind",
                    label: "Type",
                    widget: "select",
                    options: networkKinds.map((kind) => ({ label: fr.network.kinds[kind], value: kind })),
                  },
                  {
                    name: "parent",
                    label: "Hébergé par",
                    widget: "string",
                    required: false,
                    hint: "L'identifiant de la machine qui l'héberge ou le sert. Vide pour la seule racine, tout en haut (Internet).",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
