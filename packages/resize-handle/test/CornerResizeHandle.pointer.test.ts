// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { CornerResizeHandle } from "../src/index.ts";
import {
  firePointerEvent,
  installPointerCaptureMock,
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("pointer drag", () => {
  test("no-op when event.button !== 0", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    let dragStartFired = false;
    crh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 1,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, false);
  });

  test('no-op when target style.display === "none"', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    target.style.display = "none";
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    let dragStartFired = false;
    crh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, false);
  });

  test('anchoring left+top ("bottom-right" handle): dragging right and down grows both axes', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    installPointerCaptureMock(crh.handleElt);
    // startDrag = (100, 80), initial size = 200x150
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 80
    });
    // delta = (50, 40) -> width 250, height 190
    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: 150,
      clientY: 120
    });

    assert.strictEqual(target.style.width, "250px");
    assert.strictEqual(target.style.height, "190px");
  });

  test('anchoring right+bottom ("top-left" handle): dragging left and up grows both axes', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const crh = new CornerResizeHandle(target, {
      horizontal: "right",
      vertical: "bottom"
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 80
    });
    // moving toward the origin grows a right/bottom-anchored box
    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: 50,
      clientY: 30
    });

    assert.strictEqual(target.style.width, "250px");
    assert.strictEqual(target.style.height, "200px");
  });

  test("clamps each axis independently to its own bounds", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top",
      minWidth: 120,
      maxWidth: 280,
      minHeight: 100,
      maxHeight: 160
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 80
    });
    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: 1000,
      clientY: 1000
    });

    assert.strictEqual(target.style.width, "280px");
    assert.strictEqual(target.style.height, "160px");

    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: -1000,
      clientY: -1000
    });

    assert.strictEqual(target.style.width, "120px");
    assert.strictEqual(target.style.height, "100px");
  });

  test('adds the "nwse" drag token for a bottom-right handle', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(
      document.documentElement.classList.contains("handle-dragging")
    );
    assert.ok(
      document.documentElement.classList.contains("nwse")
    );
  });

  test('adds the "nesw" drag token for a bottom-left handle', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "right",
      vertical: "top"
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("nesw"));
  });

  test("fires drag on each pointermove and dragEnd on pointerup", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    let dragCount = 0;
    let dragEndFired = false;
    crh.addEventListener("drag", () => {
      dragCount++;
    });
    crh.addEventListener("dragEnd", () => {
      dragEndFired = true;
    });

    installPointerCaptureMock(crh.handleElt);
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 80
    });
    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: 120,
      clientY: 90
    });
    firePointerEvent(crh.handleElt, "pointermove", {
      clientX: 140,
      clientY: 100
    });
    firePointerEvent(crh.handleElt, "pointerup", {
      pointerId: 1
    });

    assert.strictEqual(dragCount, 2);
    assert.strictEqual(dragEndFired, true);
    assert.ok(
      !document.documentElement.classList.contains("handle-dragging")
    );
  });
});
