// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { InputController, type InputActions } from "../src/InputController.ts";
import { Viewport } from "../src/Viewport.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow as unknown as Window & typeof globalThis;
  // Expose DOM event constructors from happy-dom into globalThis
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
});

function makeCanvas(): HTMLCanvasElement {
  const canvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
  canvas.width = 200;
  canvas.height = 200;
  // Provide a mock getBoundingClientRect
  (canvas as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };

  return canvas;
}

function makeActions(): {
  actions: InputActions;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    onDrawStart: [], onDrawMove: [], onDrawEnd: [],
    onPanStart: [], onPanMove: [], onPanEnd: [],
    onZoom: [], onColorPick: [], onMouseMove: []
  };

  const actions: InputActions = {
    onDrawStart: (tx, ty) => calls.onDrawStart.push([tx, ty]),
    onDrawMove: (tx, ty) => calls.onDrawMove.push([tx, ty]),
    onDrawEnd: () => calls.onDrawEnd.push([]),
    onPanStart: (mx, my) => calls.onPanStart.push([mx, my]),
    onPanMove: (dx, dy) => calls.onPanMove.push([dx, dy]),
    onPanEnd: () => calls.onPanEnd.push([]),
    onZoom: (d, cx, cy) => calls.onZoom.push([d, cx, cy]),
    onColorPick: (tx, ty) => calls.onColorPick.push([tx, ty]),
    onMouseMove: (cx, cy) => calls.onMouseMove.push([cx, cy])
  };

  return { actions, calls };
}

describe("InputController", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
    viewport.updateCanvasSize(200, 200);
    viewport.centerTexture();
  });

  describe("getMode / setMode", () => {
    test("defaults to 'paint'", () => {
      const { actions } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions });
      assert.strictEqual(ctrl.getMode(), "paint");
      ctrl.destroy();
    });

    test("can be set to 'move'", () => {
      const { actions } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions });
      ctrl.setMode("move");
      assert.strictEqual(ctrl.getMode(), "move");
      ctrl.destroy();
    });
  });

  describe("mouse events", () => {
    test("mousedown (left button) in paint mode triggers onDrawStart", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(calls.onDrawStart.length, 1);
      ctrl.destroy();
    });

    test("mousemove does NOT trigger onDrawMove when not drawing", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 0, clientX: 50, clientY: 50, bubbles: true
      }));

      assert.strictEqual(calls.onDrawMove.length, 0);
      ctrl.destroy();
    });

    test("mousedown with middle button triggers pan", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 1, clientX: 10, clientY: 10, bubbles: true
      }));

      assert.strictEqual(calls.onPanStart.length, 1);
      ctrl.destroy();
    });

    test("mousedown in move mode (left button) does NOT trigger onDrawStart", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "move" });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(calls.onDrawStart.length, 0);
      ctrl.destroy();
    });

    test("mouseleave triggers onMouseMove(-1, -1)", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions });

      canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      const last = calls.onMouseMove.at(-1);
      assert.ok(last !== undefined);
      assert.strictEqual(last[0], -1);
      assert.strictEqual(last[1], -1);
      ctrl.destroy();
    });
  });

  describe("destroy", () => {
    test("removes event listeners — no callbacks after destroy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });
      ctrl.destroy();

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));

      assert.strictEqual(calls.onDrawStart.length, 0);
    });
  });
});
