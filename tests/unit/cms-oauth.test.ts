// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as admin } from "@/app/admin/route";
import { GET as bundle } from "@/app/admin/sveltia-cms.js/route";
import { GET as auth } from "@/app/api/cms/auth/route";
import { GET as callback } from "@/app/api/cms/callback/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  authorizeUrl,
  callbackPage,
  createState,
  exchangeCode,
  oauthSettings,
  repoSettings,
  SIGN_IN_ERRORS,
  STATE_COOKIE,
  statesMatch,
  TOKEN_TIMEOUT_MS,
} from "@/cms/oauth";

const CONFIGURED = {
  CMS_GITHUB_CLIENT_ID: "client-123",
  CMS_GITHUB_CLIENT_SECRET: "secret-456",
  CMS_GITHUB_REPO: "owner/elmzn",
};

function configure(env: Record<string, string> = CONFIGURED) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

/** Whatever the developer's own shell exports, these tests start unconfigured. */
beforeEach(() => configure({ CMS_GITHUB_CLIENT_ID: "", CMS_GITHUB_CLIENT_SECRET: "", CMS_GITHUB_REPO: "" }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A request naming another host: through the proxy's X-Forwarded-Host, or straight to the server. */
const FORGED_HOSTS: Array<Record<string, string>> = [
  { host: "elmzn.be", "x-forwarded-host": "evil.example" },
  { host: "evil.example" },
];

const request = (url: string, cookie?: string) =>
  new NextRequest(url, cookie ? { headers: { cookie } } : undefined);

/** The CMS's own check on the popup's message (Sveltia, backends/git/shared/auth.js). */
function sveltiaReads(message: string) {
  const result = message.match("^authorization:github:(success|error):(?<result>.+)")?.groups?.result;
  return result ? (JSON.parse(result) as Record<string, string>) : null;
}

/** A value the callback page's script declares, as the browser would read it. */
function scriptValue(html: string, variable: string) {
  return JSON.parse(new RegExp(`var ${variable} = (.*);`).exec(html)![1]!) as string;
}

describe("settings", () => {
  it("needs both OAuth credentials", () => {
    expect(oauthSettings({})).toBeNull();
    expect(oauthSettings({ CMS_GITHUB_CLIENT_ID: "a" })).toBeNull();
    expect(oauthSettings({ CMS_GITHUB_CLIENT_ID: "a", CMS_GITHUB_CLIENT_SECRET: "b" })).toEqual({
      clientId: "a",
      clientSecret: "b",
      scope: "repo",
    });
  });

  it("uses the narrower public_repo scope only when asked, never anything else", () => {
    const base = { CMS_GITHUB_CLIENT_ID: "a", CMS_GITHUB_CLIENT_SECRET: "b" };
    expect(oauthSettings({ ...base, CMS_GITHUB_SCOPE: "public_repo" })?.scope).toBe("public_repo");
    expect(oauthSettings({ ...base, CMS_GITHUB_SCOPE: "admin:org" })?.scope).toBe("repo");
  });

  it("accepts only an owner/name repository, on main by default", () => {
    expect(repoSettings({ CMS_GITHUB_REPO: "owner/elmzn" })).toEqual({ repo: "owner/elmzn", branch: "main", scope: "repo" });
    expect(repoSettings({ CMS_GITHUB_REPO: "owner/elmzn", CMS_GITHUB_BRANCH: "prod" })?.branch).toBe("prod");
    for (const bad of ["", "elmzn", "owner/", "/elmzn", "owner/elmzn/extra", "https://github.com/owner/elmzn"]) {
      expect(repoSettings({ CMS_GITHUB_REPO: bad }), bad).toBeNull();
    }
  });
});

describe("state", () => {
  it("is long, random and unique", () => {
    const a = createState();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(createState()).not.toBe(a);
  });

  it("matches only itself", () => {
    const state = createState();
    expect(statesMatch(state, state)).toBe(true);
    expect(statesMatch(state, createState())).toBe(false);
    expect(statesMatch(state, state.slice(1))).toBe(false);
    expect(statesMatch("", "")).toBe(false);
  });
});

describe("GitHub exchange", () => {
  it("sends the visitor to GitHub with the app, the callback, the scope and the state", () => {
    const url = new URL(authorizeUrl({ clientId: "c", scope: "repo", state: "s", redirectUri: "https://elmzn.be/api/cms/callback" }));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "c",
      redirect_uri: "https://elmzn.be/api/cms/callback",
      scope: "repo",
      state: "s",
      allow_signup: "false",
    });
  });

  it("trades the code for a token, sending the secret server to server", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ access_token: "gho_token", token_type: "bearer" }));
    const result = await exchangeCode({ clientId: "c", clientSecret: "s", code: "k", redirectUri: "r", fetchImpl });
    expect(result).toEqual({ token: "gho_token" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(JSON.parse(String(init.body))).toEqual({ client_id: "c", client_secret: "s", code: "k", redirect_uri: "r" });
  });

  it("gives up on a stalled GitHub instead of leaving the popup hanging", async () => {
    // A server that never answers, only stopped by the request's signal.
    const stalled = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason)),
      )) as unknown as typeof fetch;
    const started = Date.now();
    const result = await exchangeCode({ clientId: "c", clientSecret: "s", code: "k", redirectUri: "r", fetchImpl: stalled, timeoutMs: 50 });
    expect(result).toMatchObject({ errorCode: SIGN_IN_ERRORS.tokenRequest });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(TOKEN_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  const exchange = (fetchImpl: typeof fetch) =>
    exchangeCode({ clientId: "c", clientSecret: "s", code: "k", redirectUri: "r", fetchImpl });

  it("passes GitHub's own refusal on, in GitHub's words", async () => {
    expect(await exchange(async () => Response.json({ error: "bad_verification_code", error_description: "Expired." }))).toEqual({
      error: "Expired.",
      errorCode: "bad_verification_code",
    });
    expect(await exchange(async () => Response.json({ error: "incorrect_client_credentials" }))).toEqual({
      error: "incorrect_client_credentials",
      errorCode: "incorrect_client_credentials",
    });
  });

  it("reports an unreachable, garbled or empty answer with the CMS's own messages", async () => {
    const offline = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await exchange(offline)).toMatchObject({ errorCode: SIGN_IN_ERRORS.tokenRequest });
    expect(await exchange(async () => new Response("<html>", { status: 500 }))).toMatchObject({
      errorCode: SIGN_IN_ERRORS.malformedResponse,
    });
    expect(await exchange(async () => Response.json({}, { status: 503 }))).toMatchObject({
      errorCode: SIGN_IN_ERRORS.tokenRequest,
    });
    expect(await exchange(async () => Response.json(null))).toMatchObject({ errorCode: SIGN_IN_ERRORS.tokenRequest });
  });

  it("only uses error codes the installed CMS has a message for", () => {
    const bundle = readFileSync(join(process.cwd(), "node_modules", "@sveltia", "cms", "dist", "sveltia-cms.js"), "utf8");
    const block = /sign_in_error:\{([^}]*)\}/.exec(bundle)?.[1] ?? "";
    for (const code of Object.values(SIGN_IN_ERRORS)) expect(block, code).toMatch(new RegExp(`\\b${code}:`));
  });
});

describe("callback page", () => {
  const extract = scriptValue;

  it("carries a success in the exact format the CMS expects", () => {
    const html = callbackPage("https://elmzn.be", { token: "gho_token" });
    expect(sveltiaReads(extract(html, "message"))).toEqual({ provider: "github", token: "gho_token" });
    expect(extract(html, "origin")).toBe("https://elmzn.be");
  });

  it("carries an error the CMS can show", () => {
    const html = callbackPage("https://elmzn.be", { error: "Expired.", errorCode: "bad_verification_code" });
    expect(sveltiaReads(extract(html, "message"))).toEqual({
      provider: "github",
      error: "Expired.",
      errorCode: "bad_verification_code",
    });
  });

  it("never posts to any origin but the site's own", () => {
    const html = callbackPage("https://elmzn.be", { token: "t" });
    expect(html).not.toContain('"*"');
    expect(html).toContain("event.origin !== origin");
  });

  it("cannot be broken out of by what it carries", () => {
    const html = callbackPage("https://elmzn.be", { error: "</script><script>alert(1)</script>", errorCode: "x" });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});

/** What the CMS panel is told by a response landing in the sign-in popup. */
async function toldToCms(response: Response) {
  return sveltiaReads(scriptValue(await response.text(), "message"));
}

describe("/api/cms/auth", () => {
  it("is off until configured, and tells the panel why", async () => {
    const response = await auth(request("https://elmzn.be/api/cms/auth?provider=github"));
    expect(response.status).toBe(503);
    expect(await toldToCms(response)).toMatchObject({ errorCode: SIGN_IN_ERRORS.notConfigured });
  });

  it("refuses another provider, and tells the panel why", async () => {
    configure();
    const response = await auth(request("https://elmzn.be/api/cms/auth?provider=gitlab"));
    expect(response.status).toBe(400);
    expect(await toldToCms(response)).toMatchObject({ errorCode: SIGN_IN_ERRORS.unsupportedProvider });
  });

  it("redirects to GitHub, the state in the URL and in a strict cookie", async () => {
    configure();
    const response = await auth(request("https://elmzn.be/api/cms/auth?provider=github&site_id=elmzn.be&scope=repo"));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.hostname).toBe("github.com");
    expect(location.searchParams.get("client_id")).toBe("client-123");
    expect(location.searchParams.get("redirect_uri")).toBe("https://elmzn.be/api/cms/callback");

    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${STATE_COOKIE}=${location.searchParams.get("state")}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toContain("Path=/api/cms");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores a scope asked for in the request: the server decides", async () => {
    configure();
    const response = await auth(request("https://elmzn.be/api/cms/auth?provider=github&scope=admin:org,delete_repo"));
    expect(new URL(response.headers.get("location")!).searchParams.get("scope")).toBe("repo");
  });

  it("always asks GitHub to come back to this site, whatever host the request names", async () => {
    configure();
    for (const headers of FORGED_HOSTS) {
      const response = await auth(new NextRequest("http://0.0.0.0:3000/api/cms/auth?provider=github", { headers }));
      const redirect = new URL(response.headers.get("location")!).searchParams.get("redirect_uri");
      expect(redirect, JSON.stringify(headers)).toBe("https://elmzn.be/api/cms/callback");
    }
  });

  it("does not require https for the cookie on a local server", async () => {
    configure();
    const response = await auth(request("http://localhost:3000/api/cms/auth?provider=github"));
    expect(response.headers.get("set-cookie")).not.toMatch(/Secure/i);
  });
});

describe("/api/cms/callback", () => {
  const cookie = (state: string) => `${STATE_COOKIE}=${state}`;

  it("is off until configured", async () => {
    const response = await callback(request("https://elmzn.be/api/cms/callback?code=k&state=s"));
    expect(response.status).toBe(503);
    expect(await toldToCms(response)).toMatchObject({ errorCode: SIGN_IN_ERRORS.notConfigured });
  });

  it("rejects a visitor who never started the sign-in (no cookie)", async () => {
    configure();
    const response = await callback(request("https://elmzn.be/api/cms/callback?code=k&state=s"));
    expect(response.status).toBe(400);
    expect(await toldToCms(response)).toMatchObject({ errorCode: SIGN_IN_ERRORS.forgedCallback });
  });

  it("rejects a state that does not match the cookie (a forged callback), without calling GitHub", async () => {
    configure();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await callback(request("https://elmzn.be/api/cms/callback?code=k&state=forged", cookie(createState())));
    expect(response.status).toBe(400);
    expect(await toldToCms(response)).toMatchObject({ errorCode: SIGN_IN_ERRORS.forgedCallback });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a callback without a code, even with a matching state", async () => {
    configure();
    const state = createState();
    const response = await callback(request(`https://elmzn.be/api/cms/callback?state=${state}`, cookie(state)));
    expect(response.status).toBe(400);
  });

  it("reports a sign-in cancelled on GitHub, in GitHub's words", async () => {
    configure();
    const response = await callback(
      request("https://elmzn.be/api/cms/callback?error=access_denied&error_description=The+user+has+denied+access."),
    );
    expect(response.status).toBe(400);
    expect(await toldToCms(response)).toEqual({
      provider: "github",
      error: "The user has denied access.",
      errorCode: "access_denied",
    });
  });

  it("hands the token over once the state matches, and forgets the state", async () => {
    configure();
    const state = createState();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: "gho_token" })));
    const response = await callback(request(`https://elmzn.be/api/cms/callback?code=k&state=${state}`, cookie(state)));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain(`${STATE_COOKIE}=; Path=/api/cms; Max-Age=0`);
    expect(await toldToCms(response)).toEqual({ provider: "github", token: "gho_token" });
  });

  it("reports a code GitHub refuses", async () => {
    configure();
    const state = createState();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "bad_verification_code" })));
    const response = await callback(request(`https://elmzn.be/api/cms/callback?code=k&state=${state}`, cookie(state)));
    expect(response.status).toBe(502);
  });
});

describe("behind Nginx Proxy Manager", () => {
  /** What the standalone server receives: its own address in the URL, the visitor's in the headers. */
  const proxied = (path: string, extra: Record<string, string> = {}) =>
    new NextRequest(`http://0.0.0.0:3000${path}`, {
      headers: { host: "elmzn.be", "x-forwarded-proto": "https", ...extra },
    });

  it("sign-in sends GitHub back to the public address, with a Secure cookie", async () => {
    configure();
    const response = await auth(proxied("/api/cms/auth?provider=github"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("redirect_uri")).toBe("https://elmzn.be/api/cms/callback");
    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("the callback hands the token over to the public origin, and asks GitHub with the public address", async () => {
    configure();
    const state = createState();
    const fetchSpy = vi.fn(async () => Response.json({ access_token: "gho_token" }));
    vi.stubGlobal("fetch", fetchSpy);
    const response = await callback(
      proxied(`/api/cms/callback?code=k&state=${state}`, { cookie: `${STATE_COOKIE}=${state}` }),
    );
    expect(scriptValue(await response.text(), "origin")).toBe("https://elmzn.be");
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).redirect_uri).toBe("https://elmzn.be/api/cms/callback");
  });

  it("the panel signs in through the public address", async () => {
    configure();
    const html = await admin(proxied("/admin")).text();
    expect(html).toContain('"base_url":"https://elmzn.be"');
    expect(html).not.toContain("0.0.0.0");
  });
});

describe("/admin", () => {
  it("explains itself when the repository is not set", async () => {
    const response = admin(request("https://elmzn.be/admin"));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("CMS_GITHUB_REPO");
  });

  it("serves the panel, never indexed, never framed, with this site as OAuth server", async () => {
    configure();
    const response = admin(request("https://elmzn.be/admin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    const html = await response.text();
    expect(html).toContain('"base_url":"https://elmzn.be"');
    expect(html).toContain('"repo":"owner/elmzn"');
    expect(html).not.toContain("secret-456");
  });

  it("never points its sign-in at a host a request names: a forged X-Forwarded-Host or Host changes nothing", async () => {
    configure();
    for (const headers of FORGED_HOSTS) {
      const html = await admin(new NextRequest("http://0.0.0.0:3000/admin", { headers })).text();
      expect(html, JSON.stringify(headers)).toContain('"base_url":"https://elmzn.be"');
      expect(html).not.toContain("evil.example");
    }
  });

  it("serves the pinned Sveltia bundle, cached for good", async () => {
    const response = bundle();
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000_000);
  });
});
