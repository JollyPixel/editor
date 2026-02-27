// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
import {
  makeContainer,
  makeTarget,
  mockBoundingRect,
  installPointerCaptureMock,
  firePointerEvent,
  fireMouseEvent
} from "./mocks.ts";

describe("constructor", () => {
  test("throws Error for invalid direction", () => {
    const container = makeContainer();
    const target = makeTarget(container);

    assert.throws(
      () => new ResizeHandle(target, { direction: "invalid" as any }),
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

  test("no collapsable class by default", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    assert.ok(!rh.handleElt.classList.contains("collapsable"));
  });

  test("collapsable: true adds collapsable CSS class", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left", collapsable: true });

    assert.ok(rh.handleElt.classList.contains("collapsable"));
  });

  test("reuses existing sibling div.resize-handle for start directions", () => {
    const container = makeContainer();
    const target = makeTarget(container);

    const existingHandle = document.createElement("div") as unknown as HTMLElement;
    existingHandle.classList.add("resize-handle");
    container.appendChild(existingHandle);

    const rh = new ResizeHandle(target, { direction: "left" });

    assert.strictEqual(rh.handleElt, existingHandle);
  });

  test("reuses existing sibling div.resize-handle for end directions", () => {
    const container = makeContainer();

    const existingHandle = document.createElement("div") as unknown as HTMLElement;
    existingHandle.classList.add("resize-handle");
    container.appendChild(existingHandle);

    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "right" });

    assert.strictEqual(rh.handleElt, existingHandle);
  });
});

describe("double-click — collapse / expand", () => {
  test("no-op when event.button !== 0", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left", collapsable: true });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 1 });

    assert.strictEqual(target.style.display, "");
  });

  test("no-op when handle has no collapsable class", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
  });

  test('collapse horizontal ("left"): saves width, sets display:none, sets width:0px', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left", collapsable: true });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "none");
    assert.strictEqual(target.style.width, "0px");
  });

  test("expand horizontal: restores saved width, clears display", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left", collapsable: true });

    // Collapse first (width=200 > 0 → collapse path)
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    // Now mock the rect as collapsed so the next dblclick takes the expand path
    mockBoundingRect(target, 0, 150);
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.width, "200px");
  });

  test('collapse vertical ("top"): saves height, sets display:none, sets height:0px', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "top", collapsable: true });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "none");
    assert.strictEqual(target.style.height, "0px");
  });

  test("expand vertical: restores saved height, clears display", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "top", collapsable: true });

    // Collapse first (height=150 > 0 → collapse path)
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    // Mock rect as collapsed so next dblclick takes the expand path
    mockBoundingRect(target, 200, 0);
    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.height, "150px");
  });

  test("expand when savedSize is null falls back to 0", () => {
    const container = makeContainer();
    // Target starts with zero size → first dblclick goes straight to expand path
    const target = makeTarget(container, 0, 0);
    const rh = new ResizeHandle(target, { direction: "left", collapsable: true });

    fireMouseEvent(rh.handleElt, "dblclick", { button: 0 });

    // savedSize was null → newSize = null ?? 0 = 0
    assert.strictEqual(target.style.display, "");
    assert.strictEqual(target.style.width, "0px");
  });
});

describe("pointer drag", () => {
  test("no-op when event.button !== 0", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragStartFired = false;
    rh.addEventListener("dragStart", () => {
      dragStartFired = true;
    });

    firePointerEvent(rh.handleElt, "pointerdown", { button: 1, pointerId: 1 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

    assert.strictEqual(dragStartFired, true);
  });

  test("calls setPointerCapture with the event's pointerId", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    const state = installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 7 });

    assert.strictEqual(state.captured, 7);
  });

  test('adds "handle-dragging" to document.documentElement on pointerdown', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

    assert.ok(document.documentElement.classList.contains("handle-dragging"));
  });

  test('horizontal direction ("left") adds "vertical" class to documentElement', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

    assert.ok(document.documentElement.classList.contains("vertical"));
  });

  test('vertical direction ("top") adds "horizontal" class to documentElement', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "top" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

    assert.ok(document.documentElement.classList.contains("horizontal"));
  });

  test('"left" direction: pointermove right → width increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    // startDrag = clientX=100, initialSize=200
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientX: 100 });
    // delta=150, size = 200 + (150 - 100) = 250
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 150 });

    assert.strictEqual(target.style.width, "250px");
  });

  test('"right" direction: pointermove left → width increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "right" });

    installPointerCaptureMock(rh.handleElt);
    // startDrag = clientX=100, initialSize=200
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientX: 100 });
    // delta=50, size = 200 + (100 - 50) = 250
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 50 });

    assert.strictEqual(target.style.width, "250px");
  });

  test('"top" direction: pointermove downward → height increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "top" });

    installPointerCaptureMock(rh.handleElt);
    // startDrag = clientY=50, initialSize=150
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientY: 50 });
    // delta=100, size = 150 + (100 - 50) = 200
    firePointerEvent(rh.handleElt, "pointermove", { clientY: 100 });

    assert.strictEqual(target.style.height, "200px");
  });

  test('"bottom" direction: pointermove upward → height increases', () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "bottom" });

    installPointerCaptureMock(rh.handleElt);
    // startDrag = clientY=100, initialSize=150
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientY: 100 });
    // delta=50, size = 150 + (100 - 50) = 200
    firePointerEvent(rh.handleElt, "pointermove", { clientY: 50 });

    assert.strictEqual(target.style.height, "200px");
  });

  test("fires drag event on each pointermove", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    let dragCount = 0;
    rh.addEventListener("drag", () => {
      dragCount++;
    });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientX: 100 });
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 120 });
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 140 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });
    firePointerEvent(rh.handleElt, "pointerup", { pointerId: 1 });

    assert.strictEqual(dragEndFired, true);
  });

  test("calls releasePointerCapture on pointerup", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    const state = installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 3 });
    assert.strictEqual(state.captured, 3);

    firePointerEvent(rh.handleElt, "pointerup", { pointerId: 3 });

    assert.strictEqual(state.captured, null);
  });

  test('removes "handle-dragging" and direction class on pointerup', () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    installPointerCaptureMock(rh.handleElt);
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1, clientX: 100 });
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 120 });
    assert.strictEqual(dragCount, 1);

    firePointerEvent(rh.handleElt, "pointerup");

    // Additional moves after cleanup should not fire drag
    firePointerEvent(rh.handleElt, "pointermove", { clientX: 140 });

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
    firePointerEvent(rh.handleElt, "pointerdown", { button: 0, pointerId: 1 });

    assert.ok(document.documentElement.classList.contains("handle-dragging"));

    firePointerEvent(rh.handleElt, "pointercancel");

    assert.ok(!document.documentElement.classList.contains("handle-dragging"));
    assert.strictEqual(state.captured, null);
    assert.strictEqual(dragEndFired, true);
  });
});
