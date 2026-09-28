import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { interpolate, placeholders } from "@/lib/interpolate";

const text = (node: React.ReactNode) => render(<p>{node}</p>).container.textContent;

describe("interpolate", () => {
  it("fills placeholders with text, keeping the sentence's own word order", () => {
    expect(text(interpolate("Reçus par {host} ({country}).", { host: "OVHcloud", country: "France" }))).toBe(
      "Reçus par OVHcloud (France).",
    );
  });

  it("fills them with elements, such as links", () => {
    const { container } = render(<p>{interpolate("Écrire à {email}.", { email: <a href="mailto:x@y.z">x@y.z</a> })}</p>);
    expect(container.querySelector("a")).toHaveAttribute("href", "mailto:x@y.z");
    expect(container.textContent).toBe("Écrire à x@y.z.");
  });

  it("fills every occurrence of a placeholder", () => {
    expect(text(interpolate("{a} et {a}", { a: "x" }))).toBe("x et x");
  });

  it("leaves a placeholder without a value as written, so tests can catch it", () => {
    expect(text(interpolate("{a} {b}", { a: "x" }))).toBe("x {b}");
  });

  it("returns a template without placeholders unchanged", () => {
    expect(text(interpolate("Rien à remplir.", {}))).toBe("Rien à remplir.");
  });
});

describe("placeholders", () => {
  it("lists each placeholder once, in order", () => {
    expect(placeholders("{host} traite… selon {policy} ; {host} adhère")).toEqual(["host", "policy"]);
    expect(placeholders("aucun")).toEqual([]);
  });
});
