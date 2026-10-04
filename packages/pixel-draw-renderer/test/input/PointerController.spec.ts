// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import {
  createPointerController,
  makeCenteredViewport
} from "../helpers/input/pointer.ts";

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
      const ctrl = createPointerController({
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

      assert.strictEqual(calls.onPrimaryMove.length, 0);
      ctrl.destroy();
    });

    test("mousedown with middle button triggers pan", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
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

      assert.strictEqual(calls.onPanStart.length, 1);
      ctrl.destroy();
    });
  });

  describe("contextmenu", () => {
    test("right-click suppresses the browser context menu and triggers no action", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
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
        onPrimaryDown: [],
        onPrimaryMove: [],
        onPrimaryUp: [],
        onSecondaryDown: [],
        onSecondaryMove: [],
        onSecondaryUp: [],
        onPanStart: [],
        onPanMove: [],
        onPanEnd: [],
        onZoom: [],
        onCanvasHover: [],
        onTextureCursorMove: [],
        onMouseUp: [],
        onBlur: []
      });
      ctrl.destroy();
    });
  });

  describe("destroy", () => {
    test("removes event listeners so no callback fires after destroy", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
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

      assert.strictEqual(calls.onPrimaryDown.length, 0);
    });
  });

  describe("onPrimaryDown return value", () => {
    test("returning false prevents onPrimaryMove/onPrimaryUp from firing for that gesture", () => {
      const { actions, calls } = makeActions({ onPrimaryDownReturns: false });
      const ctrl = createPointerController({
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

      assert.strictEqual(calls.onPrimaryDown.length, 1);
      assert.strictEqual(calls.onPrimaryMove.length, 0);
      assert.strictEqual(calls.onPrimaryUp.length, 0);
      ctrl.destroy();
    });

    test("returning true tracks the gesture normally", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
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

      assert.strictEqual(calls.onPrimaryMove.length, 1);
      assert.strictEqual(calls.onPrimaryUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("stopDrawing", () => {
    test("stops tracking the current gesture while the unconditional onMouseUp still fires", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
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
      ctrl.stopDrawing();

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

      assert.strictEqual(calls.onPrimaryMove.length, 0);
      assert.strictEqual(calls.onPrimaryUp.length, 0);
      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });
  });
});
