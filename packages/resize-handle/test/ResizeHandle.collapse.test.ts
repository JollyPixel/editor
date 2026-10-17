// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
import {
  fireMouseEvent,
  makeContainer,
  makeTarget,
  mockBoundingRect
} from "./mocks.ts";

describe("double-click — collapse / expand", () => {
  test("no-op when event.button !== 0", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, {
      direction: "left",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 1 });

    assert.strictEqual(target.style.display, "");
  });

  test("no-op when handle has no collapsible class", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
  });

  test('collapse horizontal ("left"): saves width, sets display:none, sets width:0px', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "left",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "none");
    assert.strictEqual(target.style.width, "0px");
  });

  test("expand horizontal: restores saved width, clears display", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "left",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    mockBoundingRect(target, 0, 150);
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.width, "200px");
  });

  test('collapse vertical ("top"): saves height, sets display:none, sets height:0px', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "top",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "none");
    assert.strictEqual(target.style.height, "0px");
  });

  test("expand vertical: restores saved height, clears display", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "top",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    mockBoundingRect(target, 200, 0);
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.height, "150px");
  });

  test("expand when savedSize is null falls back to 0", () => {
    const container = makeContainer();
    const target = makeTarget(container, 0, 0);
    const rh = new ResizeHandle(target, {
      direction: "left",
      collapsible: true
    });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.width, "0px");
  });
});
