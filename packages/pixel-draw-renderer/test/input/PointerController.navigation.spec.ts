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
import {
  pressControl,
  releaseControl,
  wheel
} from "../helpers/events.ts";

describe("PointerController navigation", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = makeCenteredViewport();
  });

  describe("primary-drag pan (navigation mode)", () => {
    test("left-drag pans the viewport instead of drawing when the actions pan on primary", (t) => {
      const applyPan = t.mock.method(viewport, "applyPan");
      const { actions, calls } = makeActions({ pansOnPrimary: true });
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
      window.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 130,
        clientY: 118,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onPointerDown.length, 0);
      assert.strictEqual(calls.onPanStart, 1);
      assert.deepStrictEqual(
        applyPan.mock.calls.map((call) => call.arguments),
        [[30, 18]]
      );
      assert.strictEqual(calls.onPanEnd, 1);
      ctrl.destroy();
    });

    test("left-drag draws at the resolved texture position otherwise", () => {
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

      assert.deepStrictEqual(calls.onPointerDown, [["primary", 8, 8, false]]);
      assert.strictEqual(calls.onPanStart, 0);
      ctrl.destroy();
    });
  });

  test("window blur ends a primary-drag pan", () => {
    const { actions, calls } = makeActions({ pansOnPrimary: true });
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
    window.dispatchEvent(new Event("blur"));

    assert.strictEqual(calls.onPanEnd, 1);
    assert.strictEqual(calls.onBlur, 1);
    ctrl.destroy();
  });

  describe("wheel zoom", () => {
    test("pixel-mode wheel zooms the viewport by deltaY, then reports the hover", (t) => {
      const applyZoom = t.mock.method(viewport, "applyZoom");
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(wheel({ deltaY: 100 }));

      assert.strictEqual(applyZoom.mock.callCount(), 1);
      assert.strictEqual(applyZoom.mock.calls[0].arguments[0], 100);
      assert.strictEqual(calls.onHover.length, 1);
      ctrl.destroy();
    });

    test("line-mode wheel is normalized to an approximate pixel delta", (t) => {
      const applyZoom = t.mock.method(viewport, "applyZoom");
      const { actions } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(wheel({ deltaY: 3, deltaMode: 1 }));

      assert.strictEqual(applyZoom.mock.calls[0].arguments[0], 48);
      ctrl.destroy();
    });

    test("ctrl+wheel zooms when the actions do not handle it", (t) => {
      const applyZoom = t.mock.method(viewport, "applyZoom");
      const { actions, calls } = makeActions();
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      pressControl();
      const event = wheel({ deltaY: -8, ctrlKey: true });
      canvas.dispatchEvent(event);

      assert.deepStrictEqual(calls.onCtrlWheel, [-8]);
      assert.strictEqual(applyZoom.mock.callCount(), 1);
      assert.strictEqual(applyZoom.mock.calls[0].arguments[0], -8);
      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("a handled ctrl+wheel suppresses zoom and the browser default", (t) => {
      const applyZoom = t.mock.method(viewport, "applyZoom");
      const { actions } = makeActions({ handlesCtrlWheel: true });
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      pressControl();
      const event = wheel({ deltaY: -8, ctrlKey: true });
      canvas.dispatchEvent(event);

      assert.strictEqual(applyZoom.mock.callCount(), 0);
      assert.ok(event.defaultPrevented);
      ctrl.destroy();
    });

    test("a ctrl+wheel without a held Control key is a pinch that scales the zoom by exp(-deltaY / 100)", (t) => {
      const applyZoom = t.mock.method(viewport, "applyZoom");
      const applyScale = t.mock.method(viewport, "applyScale");
      const { actions, calls } = makeActions({ handlesCtrlWheel: true });
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(wheel({ deltaY: -3, ctrlKey: true }));
      pressControl();
      releaseControl();
      canvas.dispatchEvent(wheel({ deltaY: 5, ctrlKey: true }));

      assert.deepStrictEqual(calls.onCtrlWheel, []);
      assert.strictEqual(applyZoom.mock.callCount(), 0);
      assert.deepStrictEqual(
        applyScale.mock.calls.map((call) => call.arguments[0]),
        [Math.exp(0.03), Math.exp(-0.05)]
      );
      ctrl.destroy();
    });

    test("a Control key seen on a canvas pointer event routes ctrl+wheel to the actions", () => {
      const { actions, calls } = makeActions({ handlesCtrlWheel: true });
      const ctrl = new PointerController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(new MouseEvent("mousemove", {
        ctrlKey: true,
        bubbles: true
      }));
      canvas.dispatchEvent(wheel({ deltaY: -8, ctrlKey: true }));
      window.dispatchEvent(new Event("blur"));
      canvas.dispatchEvent(wheel({ deltaY: -8, ctrlKey: true }));

      assert.deepStrictEqual(calls.onCtrlWheel, [-8]);
      ctrl.destroy();
    });
  });
});
