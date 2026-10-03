// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  overflowTitleEnabled,
  revealOverflowTitle,
  syncOverflowTitle
} from "../../src/interaction/overflowTitle.ts";

function label(
  text: string,
  widths: { content: number; box: number; }
): HTMLElement {
  const element = document.createElement("span");
  element.textContent = text;
  Object.defineProperty(element, "scrollWidth", { value: widths.content });
  Object.defineProperty(element, "clientWidth", { value: widths.box });

  return element;
}

describe("overflowTitleEnabled", () => {
  test("is enabled without any attribute", () => {
    assert.equal(overflowTitleEnabled(document.createElement("span")), true);
  });

  test("follows the nearest ancestor, across a shadow boundary", () => {
    const scope = document.createElement("div");
    scope.setAttribute("overflow-title", "off");
    const host = document.createElement("div");
    scope.append(host);
    const inner = document.createElement("span");
    host.attachShadow({ mode: "open" }).append(inner);

    assert.equal(overflowTitleEnabled(inner), false);

    host.setAttribute("overflow-title", "on");
    assert.equal(overflowTitleEnabled(inner), true);
  });
});

describe("syncOverflowTitle", () => {
  test("titles a cut-off label with its full text", () => {
    const element = label("  A very long block name ", { content: 120, box: 40 });

    syncOverflowTitle(element);

    assert.equal(element.title, "A very long block name");
  });

  test("leaves no title on a label that fits", () => {
    const element = label("Arm", { content: 40, box: 40 });
    element.title = "stale";

    syncOverflowTitle(element);

    assert.equal(element.hasAttribute("title"), false);
  });

  test("leaves no title when an ancestor switches it off", () => {
    const scope = document.createElement("div");
    scope.setAttribute("overflow-title", "off");
    const element = label("A very long block name", { content: 120, box: 40 });
    scope.append(element);

    syncOverflowTitle(element);

    assert.equal(element.hasAttribute("title"), false);
  });
});

describe("revealOverflowTitle", () => {
  test("syncs the element the handler is bound to", () => {
    const element = label("A very long block name", { content: 120, box: 40 });
    element.addEventListener("pointerenter", revealOverflowTitle);

    element.dispatchEvent(new Event("pointerenter"));

    assert.equal(element.title, "A very long block name");
  });
});
