import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * GitHub sign-in for the CMS: the small OAuth server Sveltia CMS expects,
 * served by this site itself (no third-party auth service). The protocol is
 * Decap/Netlify's: the CMS opens a popup on the auth endpoint, GitHub sends
 * the visitor back to the callback, and the callback hands the token to the
 * CMS window through a two-step `postMessage` handshake.
 */

export const STATE_COOKIE = "elmzn_cms_state";
export const STATE_MAX_AGE_SECONDS = 600;
export const CALLBACK_PATH = "/api/cms/callback";

const PROVIDER = "github";
const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** A stalled GitHub never leaves the sign-in popup hanging. */
export const TOKEN_TIMEOUT_MS = 10_000;

/**
 * Error codes Sveltia CMS knows (its `sign_in_error.*` messages), so the panel
 * shows its own translated explanation. Any other code falls back to the
 * `error` text, which is how GitHub's own refusals are shown.
 */
export const SIGN_IN_ERRORS = {
  notConfigured: "MISCONFIGURED_CLIENT",
  unsupportedProvider: "UNSUPPORTED_BACKEND",
  forgedCallback: "CSRF_DETECTED",
  tokenRequest: "TOKEN_REQUEST_FAILED",
  malformedResponse: "MALFORMED_RESPONSE",
} as const;

type Env = Record<string, string | undefined>;
export type Scope = "repo" | "public_repo";

export interface OAuthSettings {
  clientId: string;
  clientSecret: string;
  scope: Scope;
}

export interface RepoSettings {
  repo: string;
  branch: string;
  scope: Scope;
}

function scopeFrom(env: Env): Scope {
  return env.CMS_GITHUB_SCOPE === "public_repo" ? "public_repo" : "repo";
}

/** The OAuth app's credentials, or null when sign-in is not set up. */
export function oauthSettings(env: Env = process.env): OAuthSettings | null {
  const clientId = env.CMS_GITHUB_CLIENT_ID?.trim();
  const clientSecret = env.CMS_GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, scope: scopeFrom(env) };
}

/** The repository the CMS commits to, or null when it is not set (or not `owner/name`). */
export function repoSettings(env: Env = process.env): RepoSettings | null {
  const repo = env.CMS_GITHUB_REPO?.trim();
  if (!repo || !REPO_PATTERN.test(repo)) return null;
  return { repo, branch: env.CMS_GITHUB_BRANCH?.trim() || "main", scope: scopeFrom(env) };
}

/** An unguessable value tying the callback to the browser that started the sign-in. */
export function createState(): string {
  return randomBytes(32).toString("hex");
}

/** Constant-time comparison, so the state cannot be guessed byte by byte. */
export function statesMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Where to send the visitor to approve access. The scope is the server's
 * choice, never the one the request asks for.
 */
export function authorizeUrl({
  clientId,
  scope,
  state,
  redirectUri,
}: {
  clientId: string;
  scope: Scope;
  state: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    allow_signup: "false",
  });
  return `${GITHUB_AUTHORIZE}?${params}`;
}

export type TokenResult = { token: string } | { error: string; errorCode: string };

/** Trades the one-time code for an access token, server to server. */
export async function exchangeCode({
  clientId,
  clientSecret,
  code,
  redirectUri,
  fetchImpl = fetch,
  timeoutMs = TOKEN_TIMEOUT_MS,
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TokenResult> {
  let response: Response;
  try {
    response = await fetchImpl(GITHUB_TOKEN, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { error: "GitHub could not be reached.", errorCode: SIGN_IN_ERRORS.tokenRequest };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { error: `GitHub answered ${response.status} without JSON.`, errorCode: SIGN_IN_ERRORS.malformedResponse };
  }
  const fields = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;

  if (typeof fields.access_token === "string" && fields.access_token) return { token: fields.access_token };
  if (typeof fields.error === "string" && fields.error) {
    // GitHub's own refusal (expired code, wrong credentials…): its words are the clearest.
    const error = typeof fields.error_description === "string" ? fields.error_description : fields.error;
    return { error, errorCode: fields.error };
  }
  return { error: `GitHub answered ${response.status} without a token.`, errorCode: SIGN_IN_ERRORS.tokenRequest };
}

/** JSON safe inside a <script>: `<` can never close the tag. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The page the popup lands on. It announces itself to the CMS window, waits
 * for the CMS to answer from this site's own origin, then hands over the
 * result — to that origin only, never to "*".
 */
export function callbackPage(origin: string, result: TokenResult): string {
  const outcome = "token" in result ? "success" : "error";
  const content =
    "token" in result
      ? { provider: PROVIDER, token: result.token }
      : { provider: PROVIDER, error: result.error, errorCode: result.errorCode };
  const message = `authorization:${PROVIDER}:${outcome}:${JSON.stringify(content)}`;
  const text =
    outcome === "success"
      ? "Connexion réussie. Cette fenêtre va se fermer."
      : "La connexion a échoué. Fermez cette fenêtre et réessayez.";

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>ELMZN — connexion</title></head>
<body>
<p>${text}</p>
<script>
(function () {
  var origin = ${scriptJson(origin)};
  var message = ${scriptJson(message)};
  function receive(event) {
    if (event.origin !== origin || event.data !== ${scriptJson(`authorizing:${PROVIDER}`)}) return;
    window.removeEventListener("message", receive);
    event.source.postMessage(message, origin);
  }
  window.addEventListener("message", receive);
  if (window.opener) window.opener.postMessage(${scriptJson(`authorizing:${PROVIDER}`)}, origin);
})();
</script>
</body>
</html>`;
}

/** Headers for every auth response: never cached, never indexed, never leaking the code. */
export const AUTH_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * The callback page as a response. Every outcome — even a refusal before
 * GitHub is reached — goes back to the CMS this way, so the panel always
 * shows what happened instead of waiting on a silent popup. The state is
 * single-use: the cookie is dropped as soon as a response is given.
 */
export function callbackResponse(origin: string, result: TokenResult, status: number): Response {
  return new Response(callbackPage(origin, result), {
    status,
    headers: {
      ...AUTH_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `${STATE_COOKIE}=; Path=/api/cms; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}
