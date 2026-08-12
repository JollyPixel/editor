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

describe("dispose", () => {
  test("removes a handle created by the instance", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    crh.dispose();

    assert.equal(
      target.children.length,
      0
    );
  });

  test("leaves a supplied handle in place", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const handle = document.createElement("div");
    target.appendChild(handle);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top",
      handle
    });

    crh.dispose();

    assert.strictEqual(handle.parentElement, target);
  });

  test("is idempotent", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });

    assert.doesNotThrow(() => {
      crh.dispose();
      crh.dispose();
    });
  });

  test("ends an active pointer drag", () => {
    const container = makeContainer();
    const target = makeTarget(container);
    const crh = new CornerResizeHandle(target, {
      horizontal: "left",
      vertical: "top"
    });
    const capture = installPointerCaptureMock(crh.handleElt);
    let dragEndFired = false;
    crh.addEventListener("dragEnd", () => {
      dragEndFired = true;
    });
    firePointerEvent(crh.handleElt, "pointerdown", {
      button: 0,
      pointerId: 7
    });

    crh.dispose();

    assert.equal(capture.captured, null);
    assert.equal(dragEndFired, true);
    assert.equal(document.documentElement.classList.contains(
      "handle-dragging"
    ), false);
  });
});
