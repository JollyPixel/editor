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
  makeContainer,
  makeTarget
} from "./mocks.ts";

describe("keyboard resize", () => {
  test("resizes in the direction of the relevant arrow", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left" });

    const event = fireKeyboardEvent(rh.handleElt, "ArrowRight");

    assert.equal(target.style.width, "208px");
    assert.equal(event.defaultPrevented, true);
  });

  test("uses a 32px step with Shift", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "right" });

    fireKeyboardEvent(rh.handleElt, "ArrowLeft", {
      shiftKey: true
    });

    assert.equal(target.style.width, "232px");
  });

  test("ignores arrows from the other axis", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left" });

    const event = fireKeyboardEvent(rh.handleElt, "ArrowDown");

    assert.equal(target.style.width, "");
    assert.equal(event.defaultPrevented, false);
  });

  test("does not resize a disabled handle", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "left" });
    rh.handleElt.classList.add("disabled");

    fireKeyboardEvent(rh.handleElt, "ArrowRight");

    assert.equal(target.style.width, "");
  });

  test("clamps keyboard resizing", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, {
      direction: "left",
      maxSize: 205
    });

    fireKeyboardEvent(rh.handleElt, "ArrowRight");

    assert.equal(target.style.width, "205px");
    assert.equal(rh.handleElt.getAttribute("aria-valuenow"), "205");
  });

  test("dispatches one complete drag lifecycle per key press", () => {
    const container = makeContainer();
    const target = makeTarget(container, 200, 150);
    const rh = new ResizeHandle(target, { direction: "bottom" });
    const events: string[] = [];
    for (const name of ["dragStart", "drag", "dragEnd"]) {
      rh.addEventListener(name, () => events.push(name));
    }

    fireKeyboardEvent(rh.handleElt, "ArrowUp");

    assert.deepEqual(events, ["dragStart", "drag", "dragEnd"]);
    assert.equal(target.style.height, "158px");
  });
});
