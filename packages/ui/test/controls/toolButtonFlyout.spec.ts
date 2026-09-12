// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  isFlyoutAction,
  opensOnClick
} from "../../src/controls/toolButtonFlyout.ts";

function element(
  tagName: string,
  disabled = false
): EventTarget {
  const node = document.createElement(tagName);
  node.toggleAttribute("disabled", disabled);

  return node;
}

describe("isFlyoutAction", () => {
  it("treats a click on a button inside the flyout as an action", () => {
    const flyout = element("div");

    for (const tagName of ["button", "jolly-button", "jolly-tool-button"]) {
      assert.equal(
        isFlyoutAction([element("span"), element(tagName), flyout], flyout),
        true,
        tagName
      );
    }
  });

  it("ignores a click on a slider or input", () => {
    const flyout = element("div");

    assert.equal(
      isFlyoutAction([element("input"), element("jolly-slider"), flyout], flyout),
      false
    );
  });

  it("ignores a disabled button", () => {
    const flyout = element("div");

    assert.equal(
      isFlyoutAction([element("button", true), flyout], flyout),
      false
    );
  });

  it("stops looking once it reaches the flyout", () => {
    const flyout = element("div");

    assert.equal(
      isFlyoutAction([flyout, element("jolly-tool-button")], flyout),
      false
    );
  });
});

describe("opensOnClick", () => {
  it("leaves mouse opening to hover", () => {
    assert.equal(opensOnClick("mouse"), false);
  });

  it("opens on touch, pen and keyboard clicks", () => {
    for (const pointerType of ["touch", "pen", ""]) {
      assert.equal(opensOnClick(pointerType), true);
    }
  });
});
