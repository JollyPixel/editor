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
import { FakeWindow } from "../helpers/input/window.ts";
import { makeCenteredViewport } from "../helpers/input/pointer.ts";

describe("PointerController", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  describe("onMouseUp", () => {
    test("fires on canvas mouseup even when nothing was being tracked", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(calls.onMouseUp, 1);
      ctrl.destroy();
    });

    test("fires on window mouseup", () => {
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(calls.onMouseUp, 1);
      ctrl.destroy();
    });
  });

  describe("injected window", () => {
    test("blur is read from the injected window, not the real global", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions,
        window: fakeWindow
      });

      window.dispatchEvent(new Event("blur"));
      assert.strictEqual(calls.onBlur, 0);

      fakeWindow.dispatch("blur");
      assert.strictEqual(calls.onBlur, 1);

      ctrl.destroy();
    });

    test("mouseup on the injected window ends an in-progress gesture", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions,
        window: fakeWindow
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
      fakeWindow.dispatch("mouseup", { button: 0 });

      assert.deepStrictEqual(calls.onPointerUp, ["primary"]);
      ctrl.destroy();
    });

    test("destroy() detaches from the injected window", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions,
        window: fakeWindow
      });

      ctrl.destroy();
      fakeWindow.dispatch("blur");
      fakeWindow.dispatch("mouseup", { button: 0 });

      assert.strictEqual(calls.onBlur, 0);
      assert.strictEqual(calls.onMouseUp, 0);
    });
  });
});
