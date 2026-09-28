// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { publicOrigin } from "@/lib/public-origin";

/** What the standalone server sees: its own listening address in the URL. */
const SERVER = "http://0.0.0.0:3000/api/cms/auth";
const request = (headers: Record<string, string>, url = SERVER) => new NextRequest(url, { headers });

describe("publicOrigin", () => {
  it("behind Nginx Proxy Manager: the visitor's host and scheme, not the server's address", () => {
    expect(publicOrigin(request({ host: "elmzn.be", "x-forwarded-proto": "https" }))).toBe("https://elmzn.be");
  });

  it("prefers X-Forwarded-Host when a proxy sets it", () => {
    expect(
      publicOrigin(request({ host: "10.0.0.5:3000", "x-forwarded-host": "elmzn.be", "x-forwarded-proto": "https" })),
    ).toBe("https://elmzn.be");
  });

  it("takes the first value of a proxy chain", () => {
    expect(publicOrigin(request({ host: "elmzn.be", "x-forwarded-proto": "https, http" }))).toBe("https://elmzn.be");
  });

  it("keeps a port: local development and the E2E server", () => {
    expect(publicOrigin(request({ host: "localhost:3100" }, "http://localhost:3100/admin"))).toBe("http://localhost:3100");
  });

  it("falls back to the request's own URL without proxy headers", () => {
    expect(publicOrigin(request({}, "https://elmzn.be/admin"))).toBe("https://elmzn.be");
  });

  it("ignores a malformed host or scheme rather than echoing it", () => {
    expect(publicOrigin(request({ host: "evil.example/<script>", "x-forwarded-proto": "javascript" }))).toBe(
      "http://0.0.0.0:3000",
    );
  });
});
