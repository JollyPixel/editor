// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { ResizeHandle } from "../src/index.ts";
import {
  fireKeyboardEvent,
  firePointerEvent,
  installPointerCaptureMock,
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("dispose", () => {
  test("removes a handle injected by the instance", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });

    rh.dispose();

    assert.equal(container.children.length, 1);
    assert.strictEqual(container.firstElementChild, target);
  });

  test("leaves a supplied handle in place", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const handle = document.createElement("button");
    target.appendChild(handle);
    const rh = new ResizeHandle(target, {
      direction: "left",
      handle
    });

    rh.dispose();

    assert.strictEqual(handle.parentElement, target);
  });

  test("leaves a reused sibling handle in place", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const handle = document.createElement("div");
    handle.classList.add("resize-handle");
    container.appendChild(handle);
    const rh = new ResizeHandle(target, { direction: "left" });

    rh.dispose();

    assert.strictEqual(handle.parentElement, container);
  });

  test("stops responding and is idempotent", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const handle = document.createElement("button");
    target.appendChild(handle);
    const rh = new ResizeHandle(target, {
      direction: "left",
      handle
    });

    rh.dispose();
    rh.dispose();
    fireKeyboardEvent(handle, "ArrowRight");

    assert.equal(target.style.width, "");
  });

  test("ends an active pointer drag", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const rh = new ResizeHandle(target, { direction: "left" });
    const capture = installPointerCaptureMock(rh.handleElt);
    let dragEndFired = false;
    rh.addEventListener("dragEnd", () => {
      dragEndFired = true;
    });
    firePointerEvent(rh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 7
    });

    rh.dispose();

    assert.equal(capture.captured, null);
    assert.equal(dragEndFired, true);
    assert.equal(document.documentElement.classList.contains(
      "handle-dragging"
    ), false);
  });
});
