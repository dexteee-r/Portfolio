/**
 * The origin the visitor actually used — `https://elmzn.be` — as opposed to
 * the address the server listens on. Behind Nginx Proxy Manager, the
 * standalone server builds request URLs from its own address
 * (`http://0.0.0.0:3000`): the public host comes from the Host header (or
 * X-Forwarded-Host), the scheme from X-Forwarded-Proto, both set by the proxy.
 *
 * A forged header only misleads the request that carries it: GitHub refuses
 * any callback address but the one registered for the OAuth App.
 */

const HOST = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

/** First value of a header that may hold a comma-separated list (proxy chains). */
function first(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

export function publicOrigin(request: { headers: Headers; nextUrl: URL }): string {
  const fallback = request.nextUrl;
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  const proto = first(request.headers.get("x-forwarded-proto"));
  const scheme = proto === "https" || proto === "http" ? proto : fallback.protocol.replace(/:$/, "");
  return `${scheme}://${host && HOST.test(host) ? host : fallback.host}`;
}
