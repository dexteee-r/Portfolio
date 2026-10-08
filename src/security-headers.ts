/**
 * Sent with every response (next.config.ts). HSTS is set in front, by Nginx
 * Proxy Manager. Each header only narrows what a browser lets other sites — or
 * an injected script — do with these pages:
 *
 * - no other site may show them in a frame (clickjacking);
 * - no `<base>`, plugin or form may point anywhere but this site;
 * - a file is read as the type it is served as, never sniffed;
 * - another site learns only the origin a visitor came from, not the page;
 * - no page may ask for the camera, microphone, location, payment or USB.
 *
 * Scripts are not restricted here: Next.js inlines its own, which a strict
 * `script-src` would need nonces for — a separate step. No cross-origin opener
 * policy either: the CMS sign-in popup talks to its opener.
 *
 * Plain relative module, no `@/` alias: next.config.ts imports it.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/**
 * The CMS panel (/admin) and its sign-in (/api/cms) set stricter rules of
 * their own: never framed at all, never sending a referrer. A header from
 * next.config replaces a route's own, so these two are left to the routes
 * there, and framing is refused outright.
 */
export const OWN_RULE_PATHS = ["/admin", "/admin/:path*", "/api/cms/:path*"] as const;
const OWN_KEYS = new Set(["Content-Security-Policy", "Referrer-Policy"]);
export const OWN_RULE_HEADERS: ReadonlyArray<{ key: string; value: string }> = SECURITY_HEADERS.filter(
  (h) => !OWN_KEYS.has(h.key),
).map((h) => (h.key === "X-Frame-Options" ? { key: h.key, value: "DENY" } : h));

/** Every path but the CMS panel and its sign-in, which have their own rules. */
export const SITE_PATHS = "/:path((?!admin(?:/|$)|api/cms/).*)";

/** The rules for next.config's `headers()`, with the commit the image was built from when known. */
export function securityHeaderRules(version?: string) {
  const stamp = version ? [{ key: "X-Elmzn-Version", value: version }] : [];
  return [
    { source: SITE_PATHS, headers: [...SECURITY_HEADERS, ...stamp] },
    ...OWN_RULE_PATHS.map((source) => ({ source, headers: [...OWN_RULE_HEADERS, ...stamp] })),
  ];
}
