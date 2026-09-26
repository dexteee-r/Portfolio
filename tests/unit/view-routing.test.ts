import { describe, expect, it } from "vitest";
import {
  classifyPath,
  followedLink,
  isEditableTarget,
  isQuietMove,
  transitionFor,
} from "@/lib/view-routing";

/** Same origin as the jsdom document, as in the browser. */
const ORIGIN = window.location.origin;

describe("classifyPath", () => {
  it.each([
    ["/fr", { kind: "desk", locale: "fr" }],
    ["/en/", { kind: "desk", locale: "en" }],
    ["/fr/dev", { kind: "chapter", locale: "fr", chapter: "dev" }],
    ["/fr/creatif", { kind: "chapter", locale: "fr", chapter: "creative" }],
    ["/en/creative/some-project", { kind: "project", locale: "en", chapter: "creative", project: "some-project" }],
    ["/fr/dev/mytgc/", { kind: "project", locale: "fr", chapter: "dev", project: "mytgc" }],
    ["/fr/dev/Not_A_Slug", { kind: "other" }],
    ["/fr/dev/mytgc/deeper", { kind: "other" }],
    ["/en/creatif", { kind: "other" }],
    ["/fr/nope", { kind: "other" }],
    ["/", { kind: "other" }],
    ["/nl/dev", { kind: "other" }],
    ["/dev", { kind: "other" }],
  ])("%s", (path, expected) => {
    expect(classifyPath(path)).toEqual(expected);
  });
});

describe("transitionFor", () => {
  it("opens a chapter or a project from the frame (desk or 404) with the drawer", () => {
    expect(transitionFor("frame", "/fr/dev")).toBe("in");
    expect(transitionFor("frame", "/en/creative")).toBe("in");
    expect(transitionFor("frame", "/fr/dev/mytgc")).toBe("in");
  });

  it("closes a chapter or a project back onto the desk with the drawer", () => {
    expect(transitionFor("chapter", "/fr")).toBe("out");
    expect(transitionFor("project", "/en")).toBe("out");
  });

  it("leaves every other navigation ordinary", () => {
    expect(transitionFor("frame", "/fr")).toBeNull(); // desk → desk
    expect(transitionFor("frame", "/en")).toBeNull(); // language switch
    expect(transitionFor("chapter", "/fr/infra")).toBeNull(); // chapter → chapter
    expect(transitionFor("chapter", "/fr/dev/mytgc")).toBeNull(); // station → project
    expect(transitionFor("project", "/fr/dev")).toBeNull(); // project → its chapter
    expect(transitionFor("chapter", "/fr/nope")).toBeNull();
    expect(transitionFor(null, "/fr/dev")).toBeNull(); // unknown view
  });
});

describe("isQuietMove", () => {
  it("covers moves inside one chapter, in one language", () => {
    expect(isQuietMove("/fr/dev", "/fr/dev/mytgc")).toBe(true);
    expect(isQuietMove("/fr/dev/mytgc", "/fr/dev")).toBe(true);
    expect(isQuietMove("/fr/dev/mytgc", "/fr/dev/schooltrack")).toBe(true);
  });

  it("leaves out everything else", () => {
    expect(isQuietMove("/fr/dev", "/fr/dev")).toBe(false); // no move
    expect(isQuietMove("/fr/dev", "/fr/infra")).toBe(false); // another chapter
    expect(isQuietMove("/fr/dev/mytgc", "/en/dev/mytgc")).toBe(false); // language switch
    expect(isQuietMove("/fr", "/fr/dev")).toBe(false); // the drawer's job
    expect(isQuietMove("/fr/dev", "/fr")).toBe(false);
    expect(isQuietMove("/fr/dev", "/fr/nope")).toBe(false);
  });
});

describe("followedLink", () => {
  function clickOn(
    html: string,
    selector: string,
    init: MouseEventInit = {},
  ): { url: URL | null; event: MouseEvent } {
    document.body.innerHTML = html;
    const target = document.querySelector(selector)!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    Object.defineProperty(event, "target", { value: target });
    return { url: followedLink(event, ORIGIN), event };
  }

  it("follows a plain left click on an internal link", () => {
    expect(clickOn('<a href="/fr/dev">x</a>', "a").url?.pathname).toBe("/fr/dev");
  });

  it("follows a click that lands on something inside the link", () => {
    const { url } = clickOn('<a href="/fr/dev"><svg><path id="p"/></svg></a>', "#p");
    expect(url?.pathname).toBe("/fr/dev");
  });

  it("keeps query and hash", () => {
    const { url } = clickOn('<a href="/fr/dev?x=1#top">x</a>', "a");
    expect(url?.search).toBe("?x=1");
    expect(url?.hash).toBe("#top");
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta (cmd)", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("lets the browser handle a %s click", (_, init) => {
    expect(clickOn('<a href="/fr/dev">x</a>', "a", init).url).toBeNull();
  });

  it("ignores new-tab links, downloads and other origins", () => {
    expect(clickOn('<a href="/fr/dev" target="_blank">x</a>', "a").url).toBeNull();
    expect(clickOn('<a href="/cv.pdf" download>x</a>', "a").url).toBeNull();
    expect(clickOn('<a href="https://github.com/x">x</a>', "a").url).toBeNull();
  });

  it("follows target=_self like a normal link", () => {
    expect(clickOn('<a href="/fr/dev" target="_self">x</a>', "a").url).not.toBeNull();
  });

  it("ignores clicks already handled, and clicks outside links", () => {
    document.body.innerHTML = '<a href="/fr/dev">x</a>';
    const event = new MouseEvent("click", { cancelable: true, button: 0 });
    Object.defineProperty(event, "target", { value: document.querySelector("a") });
    event.preventDefault();
    expect(followedLink(event, ORIGIN)).toBeNull();
    expect(clickOn("<p>text</p>", "p").url).toBeNull();
    expect(clickOn("<a>no href</a>", "a").url).toBeNull();
  });
});

describe("isEditableTarget", () => {
  it("protects fields and editable content", () => {
    document.body.innerHTML =
      '<input id="i"><textarea id="t"></textarea><select id="s"></select><div id="c" contenteditable="true"></div><a id="a" href="/">x</a>';
    for (const id of ["i", "t", "s", "c"]) expect(isEditableTarget(document.getElementById(id)), id).toBe(true);
    expect(isEditableTarget(document.getElementById("a"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
