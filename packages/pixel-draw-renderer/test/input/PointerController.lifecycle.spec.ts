// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { FakeWindow } from "../helpers/input/window.ts";
import {
  createPointerController,
  makeCenteredViewport
} from "../helpers/input/pointer.ts";

describe("PointerController lifecycle", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  test("primary dragging continues while another mouse button is held", () => {
    const { actions, calls } = makeActions();
    const controller = createPointerController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 3,
      clientX: 110,
      clientY: 100
    }));

    assert.strictEqual(calls.onPrimaryMove.length, 1);
    controller.destroy();
  });

  test("window blur ends active drags and clears their tracking state", () => {
    const { actions, calls } = makeActions();
    const controller = createPointerController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100
    }));
    window.dispatchEvent(new Event("blur"));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 110,
      clientY: 100
    }));
    window.dispatchEvent(new MouseEvent("mouseup"));

    assert.strictEqual(calls.onPrimaryUp.length, 1);
    assert.strictEqual(calls.onPrimaryMove.length, 0);
    controller.destroy();
  });

  test("does not report a bubbling canvas mouseup twice", () => {
    const { actions, calls } = makeActions();
    const fakeWindow = new FakeWindow();
    const controller = createPointerController({
      canvas,
      viewport,
      actions,
      window: fakeWindow
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 1,
      clientX: 100,
      clientY: 100
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup"));
    fakeWindow.dispatch("mouseup", { target: canvas });

    assert.strictEqual(calls.onMouseUp.length, 1);
    assert.strictEqual(calls.onPanEnd.length, 1);
    controller.destroy();
  });
});
