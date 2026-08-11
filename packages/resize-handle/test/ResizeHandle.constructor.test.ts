// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
import {
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("constructor", () => {
  test("throws Error for invalid direction", () => {
    const container = makeContainer();
    const target = makeTarget(container);

    assert.throws(
      // @ts-expect-error Testing invalid direction
      () => new ResizeHandle(target, { direction: "invalid" }),
      /Invalid direction/
    );
  });

  test("direction getter returns the provided direction", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.strictEqual(rh.direction, "left");
  });

  test("handleElt getter returns the created handle element", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.ok(rh.handleElt !== null);
    assert.ok(rh.handleElt.classList.contains("resize-handle"));
  });

  test("targetElt getter returns the target element", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.strictEqual(rh.targetElt, target);
  });

  test('"left" (start): handle inserted after target in DOM', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.strictEqual(target.nextElementSibling, rh.handleElt);
  });

  test('"top" (start): handle inserted after target in DOM', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "top" });

    assert.strictEqual(target.nextElementSibling, rh.handleElt);
  });

  test('"right" (end): handle inserted before target in DOM', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "right" });

    assert.strictEqual(target.previousElementSibling, rh.handleElt);
  });

  test('"bottom" (end): handle inserted before target in DOM', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "bottom" });

    assert.strictEqual(target.previousElementSibling, rh.handleElt);
  });

  test("handle element gets the direction as a CSS class", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "right" });

    assert.ok(rh.handleElt.classList.contains("right"));
  });

  test("no collapsible class by default", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.ok(!rh.handleElt.classList.contains("collapsible"));
  });

  test("collapsible: true adds collapsible CSS class", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, {
      direction: "left",
      collapsible: true
    });

    assert.ok(rh.handleElt.classList.contains("collapsible"));
  });

  test("uses a supplied handle without injecting a sibling", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const handle = document.createElement("button");
    target.appendChild(handle);

    const rh = new ResizeHandle(target, {
      direction: "left",
      handle
    });

    assert.strictEqual(rh.handleElt, handle);
    assert.strictEqual(container.children.length, 1);
  });

  test("configures the handle as an accessible separator", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "left",
      minSize: 100,
      maxSize: 300
    });

    assert.equal(rh.handleElt.getAttribute("role"), "separator");
    assert.equal(rh.handleElt.tabIndex, 0);
    assert.equal(rh.handleElt.getAttribute("aria-orientation"), "vertical");
    assert.equal(rh.handleElt.getAttribute("aria-valuemin"), "100");
    assert.equal(rh.handleElt.getAttribute("aria-valuemax"), "300");
    assert.equal(rh.handleElt.getAttribute("aria-valuenow"), "200");
  });

  test("omits an unbounded ARIA maximum", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.equal(rh.handleElt.hasAttribute("aria-valuemax"), false);
  });

  test("reuses existing sibling div.resize-handle for start directions", () => {
    const container = makeContainer();
    const target = makeTarget(container);

    const existingHandle = document.createElement("div");
    existingHandle.classList.add("resize-handle");
    container.appendChild(existingHandle);

    const rh = new ResizeHandle(target, { direction: "left" });

    assert.strictEqual(rh.handleElt, existingHandle);
  });

  test("reuses existing sibling div.resize-handle for end directions", () => {
    const container = makeContainer();

    const existingHandle = document.createElement("div");
    existingHandle.classList.add("resize-handle");
    container.appendChild(existingHandle);

    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "right" });

    assert.strictEqual(rh.handleElt, existingHandle);
  });
});
