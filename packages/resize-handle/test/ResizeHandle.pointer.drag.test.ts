// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
import {
  firePointerEvent,
  installPointerCaptureMock,
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("pointer drag", () => {
  test("fires drag event on each pointermove", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragCount = 0;
    rh.addEventListener("drag", () => {
      dragCount++;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 120
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 140
    });

    assert.strictEqual(dragCount, 2);
  });

  test("fires dragEnd event on pointerup", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragEndFired = false;
    rh.addEventListener("dragEnd", () => {
      dragEndFired = true;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });
    firePointerEvent(rh.handleElt, "pointerup", {
      pointerId: 1
    });

    assert.strictEqual(dragEndFired, true);
  });

  test("calls releasePointerCapture on pointerup", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    const state = installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 3
    });
    assert.strictEqual(state.captured, 3);

    firePointerEvent(rh.handleElt, "pointerup", {
      pointerId: 3
    });

    assert.strictEqual(state.captured, null);
  });

  test('removes "handle-dragging" and direction class on pointerup', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("handle-dragging"));
    assert.ok(document.documentElement.classList.contains("vertical"));

    firePointerEvent(rh.handleElt, "pointerup");

    assert.ok(!document.documentElement.classList.contains("handle-dragging"));
    assert.ok(!document.documentElement.classList.contains("vertical"));
  });

  test("listeners cleaned up after pointerup — no further events trigger callbacks", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragCount = 0;
    rh.addEventListener("drag", () => {
      dragCount++;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 120
    });
    assert.strictEqual(dragCount, 1);

    firePointerEvent(rh.handleElt, "pointerup");

    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 140
    });

    assert.strictEqual(dragCount, 1);
  });

  test("pointercancel triggers same cleanup as pointerup", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragEndFired = false;
    rh.addEventListener("dragEnd", () => {
      dragEndFired = true;
    });

    const state = installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("handle-dragging"));

    firePointerEvent(rh.handleElt, "pointercancel");

    assert.ok(!document.documentElement.classList.contains("handle-dragging"));
    assert.strictEqual(state.captured, null);
    assert.strictEqual(dragEndFired, true);
  });
});
