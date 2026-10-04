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
import { moveTo } from "../helpers/events.ts";

describe("PointerController", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  describe("onTextureCursorMove", () => {
    test("fires with the resolved texture position on mousemove, relative to the canvas bounds", (t) => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
        canvas,
        viewport,
        actions
      });
      t.mock.method(
        canvas,
        "getBoundingClientRect",
        () => new window.DOMRect(30, 20, 200, 200)
      );

      moveTo(canvas, 130, 120);

      assert.strictEqual(
        calls.onTextureCursorMove.length,
        1
      );
      assert.deepStrictEqual(
        calls.onTextureCursorMove[0][0],
        { x: 8, y: 8 }
      );
      ctrl.destroy();
    });

    test("fires with null when the cursor is outside texture bounds", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 1000, 1000);

      assert.strictEqual(
        calls.onTextureCursorMove.length,
        1
      );
      assert.strictEqual(
        calls.onTextureCursorMove[0][0],
        null
      );
      ctrl.destroy();
    });

    test("mouseleave reports null for both the canvas hover and the texture cursor", () => {
      const { actions, calls } = makeActions();
      const ctrl = createPointerController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 100, 100);
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );

      assert.strictEqual(
        calls.onTextureCursorMove.at(-1)?.[0],
        null
      );
      assert.deepStrictEqual(
        calls.onCanvasHover.at(-1),
        [null]
      );
      ctrl.destroy();
    });
  });
});
