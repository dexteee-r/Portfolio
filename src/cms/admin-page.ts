import path from "node:path";
import type { CmsConfig } from "@sveltia/cms";
import packageJson from "../../package.json";

/**
 * The installed Sveltia CMS bundle, served by the site itself: the pinned,
 * tested version, not whatever a CDN serves today. (Sveltia still loads its
 * own fonts from jsDelivr and checks unpkg for updates; the panel works
 * without them.) Read at build time only: its route is static.
 */
export function sveltiaBundlePath(): string {
  return path.join(process.cwd(), "node_modules", "@sveltia", "cms", "dist", "sveltia-cms.js");
}

/**
 * The pinned Sveltia version, used to bust the bundle's cache on upgrade.
 * Taken from package.json at build time, so the dynamic /admin route never
 * reads node_modules on the server.
 */
export function sveltiaVersion(): string {
  return packageJson.dependencies["@sveltia/cms"];
}

export const BUNDLE_PATH = "/admin/sveltia-cms.js";

/** JSON safe inside a <script>: `<` can never close the tag. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The editing panel: Sveltia, initialised by hand with the generated configuration. */
export function adminPage(config: CmsConfig, bundleVersion: string = sveltiaVersion()): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ELMZN — contenu</title>
<link rel="icon" href="/icon/32" type="image/png">
<script>window.CMS_MANUAL_INIT = true;</script>
<script src="${BUNDLE_PATH}?v=${encodeURIComponent(bundleVersion)}"></script>
</head>
<body>
<script>CMS.init({ config: ${scriptJson(config)} });</script>
</body>
</html>`;
}

/** Shown instead of the panel when the repository to edit is not set. */
export function notConfiguredPage(): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>ELMZN — contenu</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6">
<h1>Le CMS n'est pas encore configuré</h1>
<p>Définir la variable d'environnement <code>CMS_GITHUB_REPO</code> (au format <code>propriétaire/dépôt</code>) — voir <code>.env.example</code> et le README.</p>
</body>
</html>`;
}

/** Headers for the panel: never cached, never indexed, never framed by another site. */
export const ADMIN_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "same-origin",
} as const;
