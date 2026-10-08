// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/public-origin";
import { site } from "@/site";

/** What the standalone server sees: its own listening address in the URL. */
const SERVER = "http://0.0.0.0:3000/api/cms/auth";
const request = (headers: Record<string, string>, url = SERVER) => new NextRequest(url, { headers });

describe("publicOrigin", () => {
  it("is the site's own origin", () => {
    expect(site.url).toBe("https://elmzn.be");
  });

  it("behind Nginx Proxy Manager: the site's own origin, not the server's address", () => {
    expect(publicOrigin(request({ host: "elmzn.be", "x-forwarded-proto": "https" }))).toBe("https://elmzn.be");
  });

  it("always HTTPS for the site's own host, whatever the forwarded scheme says", () => {
    expect(publicOrigin(request({ host: "elmzn.be", "x-forwarded-proto": "http" }))).toBe("https://elmzn.be");
    expect(publicOrigin(request({ host: "ELMZN.BE" }))).toBe("https://elmzn.be");
  });

  it("ignores X-Forwarded-Host, which the proxy passes on from the client", () => {
    expect(
      publicOrigin(request({ host: "elmzn.be", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" })),
    ).toBe("https://elmzn.be");
  });

  it("never echoes an unknown host: the server's LAN address or a forged one falls back to the site", () => {
    expect(publicOrigin(request({ host: "10.0.0.5:3000" }))).toBe("https://elmzn.be");
    expect(publicOrigin(request({ host: "evil.example", "x-forwarded-proto": "https" }))).toBe("https://elmzn.be");
    expect(publicOrigin(request({ host: "elmzn.be.evil.example" }))).toBe("https://elmzn.be");
  });

  it("keeps a loopback host and its port: local development and the E2E server", () => {
    expect(publicOrigin(request({ host: "localhost:3100" }, "http://localhost:3100/admin"))).toBe("http://localhost:3100");
    expect(publicOrigin(request({ host: "127.0.0.1:3000" }, "http://127.0.0.1:3000/admin"))).toBe("http://127.0.0.1:3000");
    expect(publicOrigin(request({ host: "[::1]:3000" }, "http://[::1]:3000/admin"))).toBe("http://[::1]:3000");
  });

  it("takes the first value of a proxy chain", () => {
    expect(publicOrigin(request({ host: "localhost:3100", "x-forwarded-proto": "https, http" }))).toBe(
      "https://localhost:3100",
    );
  });

  it("falls back to the request's own URL without a Host header", () => {
    expect(publicOrigin(request({}, "https://elmzn.be/admin"))).toBe("https://elmzn.be");
  });

  it("ignores a malformed host or scheme rather than echoing it", () => {
    expect(publicOrigin(request({ host: "evil.example/<script>", "x-forwarded-proto": "javascript" }))).toBe(
      "https://elmzn.be",
    );
    expect(publicOrigin(request({ host: "localhost:3100", "x-forwarded-proto": "javascript" }, "http://localhost:3100/"))).toBe(
      "http://localhost:3100",
    );
  });
});
