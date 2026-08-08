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
import {
  spaceKeyDown,
  spaceKeyUp,
  wheel,
  hoverCanvas
} from "../helpers/events.ts";

describe("InputController navigation", () => {
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

  describe("Space-drag pan", () => {
    test("Space keydown while hovering fires onSpaceDown once (ignores key-repeat)", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(spaceKeyDown());
      window.dispatchEvent(spaceKeyDown(true));

      assert.strictEqual(calls.onSpaceDown.length, 1);
      ctrl.destroy();
    });

    test("Space keydown before any mouseenter does not fire onSpaceDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(spaceKeyDown());

      assert.strictEqual(calls.onSpaceDown.length, 0);
      ctrl.destroy();
    });

    test("Space keyup fires onSpaceUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(spaceKeyDown());
      window.dispatchEvent(spaceKeyUp());

      assert.strictEqual(calls.onSpaceUp.length, 1);
      ctrl.destroy();
    });

    test("left-drag while Space is held pans instead of drawing", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(spaceKeyDown());
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1,
        clientX: 110,
        clientY: 120,
        bubbles: true
      }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onPrimaryDown.length, 0);
      assert.strictEqual(calls.onPanStart.length, 1);
      assert.deepStrictEqual(calls.onPanMove, [[10, 20]]);
      assert.strictEqual(calls.onPanEnd.length, 1);
      ctrl.destroy();
    });

    test("without Space held, left-drag draws as usual", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
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

    test("window blur while Space is held releases it and ends any pan", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(spaceKeyDown());
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      }));
      window.dispatchEvent(new Event("blur"));

      assert.strictEqual(calls.onPanEnd.length, 1);
      assert.strictEqual(calls.onSpaceUp.length, 1);
      assert.strictEqual(calls.onBlur.length, 1);
      ctrl.destroy();
    });
  });

  describe("primary-drag pan (navigation mode)", () => {
    test("left-drag pans instead of drawing when shouldPanOnPrimary returns true", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions,
        shouldPanOnPrimary: () => true
      });

      hoverCanvas(canvas);
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
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
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

  describe("wheel zoom", () => {
    test("pixel-mode wheel passes deltaY straight through to onZoom", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
      const ctrl = new InputController({
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
      const ctrl = new InputController({
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
      const ctrl = new InputController({
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
