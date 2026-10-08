import { site } from "@/site";

/**
 * The origin the visitor actually used — `https://elmzn.be` — as opposed to
 * the address the server listens on. Behind Nginx Proxy Manager, the
 * standalone server builds request URLs from its own address
 * (`http://0.0.0.0:3000`). This origin decides where the CMS opens its
 * sign-in and where the sign-in hands its token, so it is never taken on trust:
 *
 * - the site's own host is always `site.url`, scheme included — HTTPS, whatever
 *   X-Forwarded-Proto says;
 * - a loopback host (localhost, 127.0.0.1, [::1]) is local development or the
 *   E2E server: it keeps its own port, and its scheme from X-Forwarded-Proto
 *   or the request;
 * - any other host — the server's LAN address, or a forged header — falls back
 *   to `site.url`.
 *
 * X-Forwarded-Host is ignored: the proxy passes on whatever the client sent
 * (seen in the 2026-10-08 audit). The Host header is the one the proxy routed
 * the request by.
 */

const SITE = new URL(site.url);
const HOST = /^[a-z0-9.-]+(?::\d{1,5})?$|^\[::1\](?::\d{1,5})?$/i;
const LOOPBACK = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

/** First value of a header that may hold a comma-separated list (proxy chains). */
function first(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

export function publicOrigin(request: { headers: Headers; nextUrl: URL }): string {
  const fallback = request.nextUrl;
  const raw = first(request.headers.get("host")) ?? fallback.host;
  const host = HOST.test(raw) ? raw.toLowerCase() : "";
  if (!LOOPBACK.test(host)) return SITE.origin;
  const proto = first(request.headers.get("x-forwarded-proto"));
  const scheme = proto === "https" || proto === "http" ? proto : fallback.protocol.replace(/:$/, "");
  return `${scheme}://${host}`;
}
