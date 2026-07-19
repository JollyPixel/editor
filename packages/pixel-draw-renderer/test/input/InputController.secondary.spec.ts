// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  InputController,
  type InputActions
} from "../../src/input/InputController.ts";
import { Viewport } from "../../src/rendering/Viewport.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow as unknown as Window & typeof globalThis;
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
  globalThis.KeyboardEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).KeyboardEvent as typeof KeyboardEvent;
  globalThis.HTMLElement = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).HTMLElement as typeof HTMLElement;
  globalThis.Event = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).Event as typeof Event;
});

function makeCanvas(): HTMLCanvasElement {
  const canvas = kEmulatedBrowserWindow.document.createElement("canvas") as unknown as HTMLCanvasElement;
  canvas.width = 200;
  canvas.height = 200;
  (canvas as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };

  return canvas;
}

function makeActions(options: {
  onPrimaryDownReturns?: boolean;
  onSecondaryDownReturns?: boolean;
} = {}): {
  actions: InputActions;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    onPrimaryDown: [], onPrimaryMove: [], onPrimaryUp: [],
    onSecondaryDown: [], onSecondaryMove: [], onSecondaryUp: [],
    onPanStart: [], onPanMove: [], onPanEnd: [],
    onZoom: [], onMouseMove: [],
    onCursorMove: [], onMouseUp: [],
    onShiftDown: [], onShiftUp: [], onBlur: [],
    onCopy: [], onPaste: [], onDelete: [],
    onUndo: [], onRedo: [],
    onRotate: [], onFlipHorizontal: [], onFlipVertical: []
  };

  const actions: InputActions = {
    onPrimaryDown: (tx, ty) => {
      calls.onPrimaryDown.push([tx, ty]);

      return options.onPrimaryDownReturns;
    },
    onPrimaryMove: (tx, ty) => calls.onPrimaryMove.push([tx, ty]),
    onPrimaryUp: () => calls.onPrimaryUp.push([]),
    onSecondaryDown: (tx, ty, ctrlKey) => {
      calls.onSecondaryDown.push([tx, ty, ctrlKey]);

      return options.onSecondaryDownReturns;
    },
    onSecondaryMove: (tx, ty) => calls.onSecondaryMove.push([tx, ty]),
    onSecondaryUp: () => calls.onSecondaryUp.push([]),
    onPanStart: (mx, my) => calls.onPanStart.push([mx, my]),
    onPanMove: (dx, dy) => calls.onPanMove.push([dx, dy]),
    onPanEnd: () => calls.onPanEnd.push([]),
    onZoom: (d, cx, cy) => calls.onZoom.push([d, cx, cy]),
    onMouseMove: (cx, cy) => calls.onMouseMove.push([cx, cy]),
    onCursorMove: (pos) => calls.onCursorMove.push([pos]),
    onMouseUp: () => calls.onMouseUp.push([]),
    onShiftDown: () => calls.onShiftDown.push([]),
    onShiftUp: () => calls.onShiftUp.push([]),
    onBlur: () => calls.onBlur.push([]),
    onCopy: () => calls.onCopy.push([]),
    onPaste: () => calls.onPaste.push([]),
    onDelete: () => calls.onDelete.push([]),
    onUndo: () => calls.onUndo.push([]),
    onRedo: () => calls.onRedo.push([]),
    onRotate: () => calls.onRotate.push([]),
    onFlipHorizontal: () => calls.onFlipHorizontal.push([]),
    onFlipVertical: () => calls.onFlipVertical.push([])
  };

  return { actions, calls };
}

describe("InputController secondary (right-click) mouse events", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
    viewport.updateCanvasSize(200, 200);
    viewport.centerTexture();
  });

  test("mousedown (right button) triggers onSecondaryDown with the resolved texture position and ctrlKey", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 2, clientX: 100, clientY: 100, ctrlKey: true, bubbles: true
    }));

    assert.strictEqual(calls.onSecondaryDown.length, 1);
    assert.strictEqual(calls.onSecondaryDown[0][2], true);
    ctrl.destroy();
  });

  test("dragging after right mousedown fires onSecondaryMove", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 2, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2, clientX: 110, clientY: 100, bubbles: true
    }));

    assert.strictEqual(calls.onSecondaryMove.length, 1);
    ctrl.destroy();
  });

  test("mouseup ends a tracked secondary gesture with onSecondaryUp", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 2, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(calls.onSecondaryUp.length, 1);
    ctrl.destroy();
  });

  test("onSecondaryDown returning false does not track the gesture", () => {
    const { actions, calls } = makeActions({ onSecondaryDownReturns: false });
    const ctrl = new InputController({ canvas, viewport, actions });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 2, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2, clientX: 110, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(calls.onSecondaryDown.length, 1);
    assert.strictEqual(calls.onSecondaryMove.length, 0);
    assert.strictEqual(calls.onSecondaryUp.length, 0);
    ctrl.destroy();
  });

  test("primary and secondary drags are tracked independently", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 3, clientX: 110, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(calls.onPrimaryUp.length, 1);
    assert.strictEqual(calls.onSecondaryUp.length, 1);
    ctrl.destroy();
  });
});
