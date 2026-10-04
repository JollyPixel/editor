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
import { moveTo } from "../helpers/events.ts";

describe("PointerController", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  describe("onHover", () => {
    test("reports the canvas and texture positions relative to the canvas bounds, reading them once", (t) => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });
      const bounds = t.mock.method(
        canvas,
        "getBoundingClientRect",
        () => new window.DOMRect(30, 20, 200, 200)
      );

      moveTo(canvas, 130, 120);

      assert.strictEqual(bounds.mock.callCount(), 1);
      assert.deepStrictEqual(calls.onHover, [{
        canvas: { x: 100, y: 100 },
        texture: { x: 8, y: 8 },
        boundedTexture: { x: 8, y: 8 }
      }]);
      ctrl.destroy();
    });

    test("reports a null bounded texture position when the cursor is outside the texture", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 1000, 1000);

      assert.strictEqual(calls.onHover.length, 1);
      assert.strictEqual(calls.onHover[0]?.boundedTexture, null);
      ctrl.destroy();
    });

    test("mouseleave reports null", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 100, 100);
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );

      assert.strictEqual(calls.onHover.at(-1), null);
      ctrl.destroy();
    });
  });
});
