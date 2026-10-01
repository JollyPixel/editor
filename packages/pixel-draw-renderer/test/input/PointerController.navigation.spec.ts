// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PointerController } from "#src/input/PointerController.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { wheel } from "../helpers/events.ts";

describe("PointerController navigation", () => {
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

  describe("primary-drag pan (navigation mode)", () => {
    test("left-drag pans instead of drawing when shouldPanOnPrimary returns true", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions,
        shouldPanOnPrimary: () => true
      });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 130,
        clientY: 118,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onPrimaryDown.length, 0);
      assert.strictEqual(calls.onPanStart.length, 1);
      assert.deepStrictEqual(calls.onPanMove, [[30, 18]]);
      assert.strictEqual(calls.onPanEnd.length, 1);
      ctrl.destroy();
    });

    test("left-drag draws when shouldPanOnPrimary returns false (default)", () => {
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

      assert.strictEqual(calls.onPrimaryDown.length, 1);
      assert.strictEqual(calls.onPanStart.length, 0);
      ctrl.destroy();
    });
  });

  test("window blur ends a primary-drag pan", () => {
    const { actions, calls } = makeActions();
    const ctrl = new PointerController({
      canvas,
      viewport,
      actions,
      shouldPanOnPrimary: () => true
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    window.dispatchEvent(new Event("blur"));

    assert.strictEqual(calls.onPanEnd.length, 1);
    assert.strictEqual(calls.onBlur.length, 1);
    ctrl.destroy();
  });

  describe("wheel zoom", () => {
    test("pixel-mode wheel passes deltaY straight through to onZoom", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(wheel({ deltaY: 100 }));

      assert.strictEqual(calls.onZoom.length, 1);
      assert.strictEqual(calls.onZoom[0][0], 100);
      ctrl.destroy();
    });

    test("line-mode wheel is normalized to an approximate pixel delta", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(wheel({ deltaY: 3, deltaMode: 1 }));

      assert.strictEqual(calls.onZoom[0][0], 48);
      ctrl.destroy();
    });

    test("ctrl+wheel drives zoom when it is not otherwise handled", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      const event = wheel({ deltaY: -8, ctrlKey: true });
      canvas.dispatchEvent(event);

      assert.strictEqual(calls.onZoom.length, 1);
      assert.strictEqual(calls.onZoom[0][0], -8);
      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("a handled ctrl+wheel suppresses zoom and the browser default", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions,
        onCtrlWheel: () => true
      });

      const event = wheel({ deltaY: -8, ctrlKey: true });
      canvas.dispatchEvent(event);

      assert.strictEqual(calls.onZoom.length, 0);
      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });
  });
});
