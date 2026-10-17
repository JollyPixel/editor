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
  test("no-op when event.button !== 0", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragStartFired = false;
    rh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 1,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, false);
  });

  test('no-op when target style.display === "none"', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    target.style.display = "none";
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragStartFired = false;
    rh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, false);
  });

  test('no-op when handle has "disabled" class', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });
    rh.handleElt.classList.add("disabled");

    let dragStartFired = false;
    rh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, false);
  });

  test("fires dragStart event on pointerdown", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragStartFired = false;
    rh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.strictEqual(dragStartFired, true);
  });

  test("calls setPointerCapture with the event's pointerId", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    const state = installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 7
    });

    assert.strictEqual(state.captured, 7);
  });

  test("ignores another pointer while a drag is active", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });
    const state = installPointerCaptureMock(rh.handleElt);

    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 7
    });
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 9
    });

    assert.equal(state.captured, 7);
  });

  test('adds "handle-dragging" to document.documentElement on pointerdown', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("handle-dragging"));
  });

  test('horizontal direction ("left") adds "vertical" class to documentElement', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("vertical"));
  });

  test('vertical direction ("top") adds "horizontal" class to documentElement', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "top" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1
    });

    assert.ok(document.documentElement.classList.contains("horizontal"));
  });

  test('"left" direction: pointermove right → width increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 150
    });

    assert.strictEqual(target.style.width, "250px");
  });

  test('"right" direction: pointermove left → width increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "right" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 50
    });

    assert.strictEqual(target.style.width, "250px");
  });

  test('"top" direction: pointermove downward → height increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "top" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientY: 50
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientY: 100
    });

    assert.strictEqual(target.style.height, "200px");
  });

  test('"bottom" direction: pointermove upward → height increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "bottom" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientY: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientY: 50
    });

    assert.strictEqual(target.style.height, "200px");
  });

  test("clamps pointer resizing to minSize and maxSize", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "left",
      minSize: 120,
      maxSize: 280
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 1,
      clientX: 100
    });
    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: -100
    });
    assert.equal(target.style.width, "120px");

    firePointerEvent(rh.handleElt, "pointermove", {
      clientX: 500
    });
    assert.equal(target.style.width, "280px");
    assert.equal(rh.handleElt.getAttribute("aria-valuenow"), "280");
  });
});
