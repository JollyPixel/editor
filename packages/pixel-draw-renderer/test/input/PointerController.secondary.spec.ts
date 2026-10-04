// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PointerController } from "#src/input/PointerController.ts";
import type { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { makeCenteredViewport } from "../helpers/input/pointer.ts";

describe("PointerController secondary (right-click) mouse events", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  test("mousedown (right button) reports the secondary slot, the texture position and ctrlKey", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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

    assert.deepStrictEqual(calls.onPointerDown, [["secondary", 8, 8, true]]);
    ctrl.destroy();
  });

  test("dragging after right mousedown moves the secondary drag", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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

    assert.deepStrictEqual(calls.onPointerMove, [["secondary", 10, 8]]);
    ctrl.destroy();
  });

  test("releasing the right button ends the secondary drag", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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
      new MouseEvent("mouseup", {
        button: 2,
        bubbles: true
      })
    );

    assert.deepStrictEqual(calls.onPointerUp, ["secondary"]);
    ctrl.destroy();
  });

  test("a press of the other button during a drag is ignored", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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

    assert.deepStrictEqual(
      calls.onPointerDown.map(([slot]) => slot),
      ["primary"]
    );
    ctrl.destroy();
  });

  test("releasing a button that does not own the drag leaves the drag running", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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
    canvas.dispatchEvent(new MouseEvent("mouseup", {
      button: 2,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", {
      button: 0,
      bubbles: true
    }));

    assert.deepStrictEqual(calls.onPointerMove, [["primary", 10, 8]]);
    assert.deepStrictEqual(calls.onPointerUp, ["primary"]);
    assert.strictEqual(calls.onMouseUp, 2);
    ctrl.destroy();
  });

  test("a press after a missed release ends the stale drag first", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
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
      buttons: 2,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));

    assert.deepStrictEqual(calls.onPointerUp, ["primary"]);
    assert.deepStrictEqual(
      calls.onPointerDown.map(([slot]) => slot),
      ["primary", "secondary"]
    );
    ctrl.destroy();
  });
});
