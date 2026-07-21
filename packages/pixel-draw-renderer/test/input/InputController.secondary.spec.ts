// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { InputController } from "#src/input/InputController.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";

describe("InputController secondary (right-click) mouse events", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = new Viewport({
      textureSize: { x: 16, y: 16 },
      zoom: 4
    });
    viewport.updateCanvasSize(200, 200);
    viewport.centerTexture();
  });

  test("mousedown (right button) triggers onSecondaryDown with the resolved texture position and ctrlKey", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true
    }));

    assert.strictEqual(calls.onSecondaryDown.length, 1);
    assert.ok(calls.onSecondaryDown[0][2]);
    ctrl.destroy();
  });

  test("dragging after right mousedown fires onSecondaryMove", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));

    assert.strictEqual(calls.onSecondaryMove.length, 1);
    ctrl.destroy();
  });

  test("mouseup ends a tracked secondary gesture with onSecondaryUp", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(calls.onSecondaryUp.length, 1);
    ctrl.destroy();
  });

  test("onSecondaryDown returning false does not track the gesture", () => {
    const { actions, calls } = makeActions({
      onSecondaryDownReturns: false
    });
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(calls.onSecondaryDown.length, 1);
    assert.strictEqual(calls.onSecondaryMove.length, 0);
    assert.strictEqual(calls.onSecondaryUp.length, 0);
    ctrl.destroy();
  });

  test("primary and secondary drags are tracked independently", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 3,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(calls.onPrimaryUp.length, 1);
    assert.strictEqual(calls.onSecondaryUp.length, 1);
    ctrl.destroy();
  });
});
