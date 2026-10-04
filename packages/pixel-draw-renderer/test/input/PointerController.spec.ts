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

describe("PointerController", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  describe("mouse events", () => {
    test("mousemove without the primary button held does not continue a tracked drag", () => {
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
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 0,
        clientX: 110,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(calls.onPointerMove.length, 0);
      ctrl.destroy();
    });

    test("mousedown with middle button triggers pan", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 1,
        clientX: 10,
        clientY: 10,
        bubbles: true
      }));

      assert.strictEqual(calls.onPanStart, 1);
      assert.strictEqual(calls.onPointerDown.length, 0);
      ctrl.destroy();
    });
  });

  describe("contextmenu", () => {
    test("right-click suppresses the browser context menu and triggers no action", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      const event = new MouseEvent("contextmenu", {
        button: 2,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(event);

      assert.ok(event.defaultPrevented);
      assert.deepStrictEqual(calls, {
        onPointerDown: [],
        onPointerMove: [],
        onPointerUp: [],
        onCtrlWheel: [],
        onPanStart: 0,
        onPanEnd: 0,
        onHover: [],
        onMouseUp: 0,
        onBlur: 0
      });
      ctrl.destroy();
    });
  });

  describe("destroy", () => {
    test("removes event listeners so no callback fires after destroy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });
      ctrl.destroy();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(calls.onPointerDown.length, 0);
    });
  });

  describe("onPointerDown return value", () => {
    test("returning false prevents onPointerMove/onPointerUp from firing for that gesture", () => {
      const { actions, calls } = makeActions({ tracksDrags: false });
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(
        new MouseEvent("mousedown", {
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          buttons: 1,
          clientX: 110,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.deepStrictEqual(calls.onPointerDown, [["primary", 8, 8, false]]);
      assert.strictEqual(calls.onPointerMove.length, 0);
      assert.strictEqual(calls.onPointerUp.length, 0);
      assert.strictEqual(calls.onMouseUp, 1);
      ctrl.destroy();
    });

    test("returning true tracks the gesture normally", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(
        new MouseEvent("mousedown", {
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          buttons: 1,
          clientX: 110,
          clientY: 100,
          bubbles: true
        })
      );
      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.deepStrictEqual(calls.onPointerMove, [["primary", 10, 8]]);
      assert.deepStrictEqual(calls.onPointerUp, ["primary"]);
      ctrl.destroy();
    });
  });
});
