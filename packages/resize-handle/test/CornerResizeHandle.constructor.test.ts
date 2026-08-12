// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { CornerResizeHandle } from "../src/index.ts";
import {
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("constructor", () => {
  test("targetElt getter returns the target element", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    assert.strictEqual(crh.targetElt, target);
  });

  test("appends a created handle as a child of the target", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    assert.strictEqual(crh.handleElt.parentElement, target);
  });

  test("handle element gets resize-handle, corner and <vertical>-<horizontal> classes for the visual corner it sits at", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    // Anchoring the left and top edges puts the handle itself bottom-right.
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    assert.ok(
      crh.handleElt.classList.contains("resize-handle")
    );
    assert.ok(
      crh.handleElt.classList.contains("corner")
    );
    assert.ok(
      crh.handleElt.classList.contains("bottom-right")
    );
  });

  test("anchoring the right and bottom edges puts the handle top-left", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "right",
      vertical: "bottom"
    });

    assert.ok(crh.handleElt.classList.contains("top-left"));
  });

  test("handle element is hidden from assistive tech and out of the tab order", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    // Pointer-only: the target's own edge ResizeHandle instances already
    // give a keyboard/screen-reader user full access to each axis.
    assert.equal(crh.handleElt.getAttribute("aria-hidden"), "true");
    assert.equal(crh.handleElt.hasAttribute("tabindex"), false);
    assert.equal(crh.handleElt.hasAttribute("role"), false);
  });

  test("uses a supplied handle without appending a new one", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const handle = document.createElement("div");
    target.appendChild(handle);

    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top",
      handle
    });

    assert.strictEqual(crh.handleElt, handle);
    assert.strictEqual(target.children.length, 1);
  });

  for (
    const [horizontal, vertical] of [
      ["left", "top"],
      ["right", "bottom"],
      ["left", "bottom"],
      ["right", "top"]
    ] as const
  ) {
    test(`constructs without error for horizontal="${horizontal}", vertical="${vertical}"`, () => {
      const container = makeContainer();
      const target = makeTarget(container);

      assert.doesNotThrow(() => new CornerResizeHandle(target, {
        horizontal,
        vertical
      }));
    });
  }
});
