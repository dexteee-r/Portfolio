// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LOCALE_HEADER } from "@/i18n/routing";
import { proxy } from "@/proxy";

const request = (path: string, init?: RequestInit) =>
  new NextRequest(new URL(path, "https://elmzn.be"), init as ConstructorParameters<typeof NextRequest>[1]);

/** NextResponse.next({ request: { headers } }) forwards overrides this way. */
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

describe("proxy", () => {
  it("redirects the root to /fr, temporarily", () => {
    const response = proxy(request("/"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/fr");
  });

  it("keeps the query string on redirect", () => {
    const response = proxy(request("/dev?ref=instagram"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/fr/dev");
    expect(location.search).toBe("?ref=instagram");
  });

  it("ignores Accept-Language entirely", () => {
    const response = proxy(request("/", { headers: { "accept-language": "en-GB,en;q=0.9" } }));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/fr");
  });

  it("lets localized paths through and tells the page their language", () => {
    const fr = proxy(request("/fr/dev"));
    expect(fr.headers.get("x-middleware-next")).toBe("1");
    expect(forwarded(fr, LOCALE_HEADER)).toBe("fr");

    const en = proxy(request("/en/nothing/here"));
    expect(forwarded(en, LOCALE_HEADER)).toBe("en");
  });

  it("does not let a visitor choose the language through the header", () => {
    const response = proxy(request("/fr/dev", { headers: { [LOCALE_HEADER]: "en" } }));
    expect(forwarded(response, LOCALE_HEADER)).toBe("fr");
  });
});
