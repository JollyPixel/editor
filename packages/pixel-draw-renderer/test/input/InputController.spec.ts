// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { InputController, type InputActions, type WindowLike } from "../../src/input/InputController.ts";
import { Viewport } from "../../src/rendering/Viewport.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow as unknown as Window & typeof globalThis;
  // Expose DOM event constructors from happy-dom into globalThis
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
  globalThis.KeyboardEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).KeyboardEvent as typeof KeyboardEvent;
  globalThis.HTMLElement = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).HTMLElement as typeof HTMLElement;
  globalThis.Event = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).Event as typeof Event;
});

function shiftKeyDown(repeat = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Shift", bubbles: true, repeat });
}

function shiftKeyUp(): KeyboardEvent {
  return new KeyboardEvent("keyup", { key: "Shift", bubbles: true });
}

function moveTo(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY, bubbles: true }));
}

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

/**
 * Minimal WindowLike fake — proves InputController never touches the real
 * global `window` when one is injected via options.window.
 */
class FakeWindow implements WindowLike {
  #listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void): void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function makeActions(options: { onDrawStartReturns?: boolean; } = {}): {
  actions: InputActions;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    onDrawStart: [], onDrawMove: [], onDrawEnd: [],
    onPanStart: [], onPanMove: [], onPanEnd: [],
    onZoom: [], onColorPick: [], onMouseMove: [],
    onCursorMove: [], onMouseUp: [],
    onShiftDown: [], onShiftUp: [], onBlur: []
  };

  const actions: InputActions = {
    onDrawStart: (tx, ty) => {
      calls.onDrawStart.push([tx, ty]);

      return options.onDrawStartReturns;
    },
    onDrawMove: (tx, ty) => calls.onDrawMove.push([tx, ty]),
    onDrawEnd: () => calls.onDrawEnd.push([]),
    onPanStart: (mx, my) => calls.onPanStart.push([mx, my]),
    onPanMove: (dx, dy) => calls.onPanMove.push([dx, dy]),
    onPanEnd: () => calls.onPanEnd.push([]),
    onZoom: (d, cx, cy) => calls.onZoom.push([d, cx, cy]),
    onColorPick: (tx, ty) => calls.onColorPick.push([tx, ty]),
    onMouseMove: (cx, cy) => calls.onMouseMove.push([cx, cy]),
    onCursorMove: (pos) => calls.onCursorMove.push([pos]),
    onMouseUp: () => calls.onMouseUp.push([]),
    onShiftDown: () => calls.onShiftDown.push([]),
    onShiftUp: () => calls.onShiftUp.push([]),
    onBlur: () => calls.onBlur.push([])
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

  describe("onCursorMove", () => {
    // With this viewport (200x200 canvas, 16x16 texture, zoom 4), the
    // texture is centered with camera = (68, 68). client(100,100) -> texture
    // (8,8).

    test("fires with the resolved texture position on mousemove", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      moveTo(canvas, 100, 100);

      assert.strictEqual(calls.onCursorMove.length, 1);
      assert.deepStrictEqual(calls.onCursorMove[0][0], { x: 8, y: 8 });
      ctrl.destroy();
    });

    test("fires with null when the cursor is outside texture bounds", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      moveTo(canvas, 1000, 1000);

      assert.strictEqual(calls.onCursorMove.length, 1);
      assert.strictEqual(calls.onCursorMove[0][0], null);
      ctrl.destroy();
    });

    test("fires with null on mouseleave", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      moveTo(canvas, 100, 100);
      canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));

      assert.strictEqual(calls.onCursorMove.at(-1)?.[0], null);
      ctrl.destroy();
    });

    test("fires regardless of the current mode", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "move" });

      moveTo(canvas, 100, 100);

      assert.strictEqual(calls.onCursorMove.length, 1);
      ctrl.destroy();
    });
  });

  describe("onMouseUp", () => {
    test("fires on canvas mouseup even when nothing was being tracked", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });

    test("fires on window mouseup", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("onDrawStart return value", () => {
    test("returning false prevents onDrawMove/onDrawEnd from firing for that gesture", () => {
      const { actions, calls } = makeActions({ onDrawStartReturns: false });
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 110, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onDrawStart.length, 1);
      assert.strictEqual(calls.onDrawMove.length, 0);
      assert.strictEqual(calls.onDrawEnd.length, 0);
      ctrl.destroy();
    });

    test("returning undefined (default) tracks the gesture normally", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 110, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onDrawMove.length, 1);
      assert.strictEqual(calls.onDrawEnd.length, 1);
      ctrl.destroy();
    });
  });

  describe("stopDrawing", () => {
    test("stops tracking the current gesture — no further onDrawMove/onDrawEnd", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      ctrl.stopDrawing();

      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 1, clientX: 110, clientY: 100, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onDrawMove.length, 0);
      assert.strictEqual(calls.onDrawEnd.length, 0);
      // onMouseUp is unconditional and still fires — consumers decide what it means.
      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("Shift key reporting", () => {
    test("a non-repeat Shift keydown fires onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("fires regardless of mode — mode relevance is left to the consumer", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "move" });

      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("OS key-repeat keydown does not fire onShiftDown again", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(shiftKeyDown());
      window.dispatchEvent(shiftKeyDown(true));

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("keydown while a text input has focus does not fire onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      const input = kEmulatedBrowserWindow.document.createElement("input");
      kEmulatedBrowserWindow.document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 0);
      ctrl.destroy();
    });

    test("keydown while a range input has focus still fires onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      const input = kEmulatedBrowserWindow.document.createElement("input");
      input.type = "range";
      kEmulatedBrowserWindow.document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("keydown while a color input has focus still fires onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      const input = kEmulatedBrowserWindow.document.createElement("input");
      input.type = "color";
      kEmulatedBrowserWindow.document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("a non-Shift key does not fire onShiftDown/onShiftUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control", bubbles: true }));

      assert.strictEqual(calls.onShiftDown.length, 0);
      assert.strictEqual(calls.onShiftUp.length, 0);
      ctrl.destroy();
    });

    test("Shift keyup fires onShiftUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(shiftKeyUp());

      assert.strictEqual(calls.onShiftUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("onBlur", () => {
    test("window blur fires onBlur", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint" });

      window.dispatchEvent(new Event("blur"));

      assert.strictEqual(calls.onBlur.length, 1);
      ctrl.destroy();
    });
  });

  describe("injected window", () => {
    test("keydown/keyup/blur are read from the injected window, not the real global", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint", window: fakeWindow });

      window.dispatchEvent(shiftKeyDown());
      assert.strictEqual(calls.onShiftDown.length, 0);

      fakeWindow.dispatch("keydown", { key: "Shift", repeat: false, target: null });
      assert.strictEqual(calls.onShiftDown.length, 1);

      fakeWindow.dispatch("keyup", { key: "Shift" });
      assert.strictEqual(calls.onShiftUp.length, 1);

      fakeWindow.dispatch("blur");
      assert.strictEqual(calls.onBlur.length, 1);

      ctrl.destroy();
    });

    test("mouseup on the injected window ends an in-progress draw gesture", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint", window: fakeWindow });

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      fakeWindow.dispatch("mouseup");

      assert.strictEqual(calls.onDrawEnd.length, 1);
      ctrl.destroy();
    });

    test("destroy() detaches from the injected window", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({ canvas, viewport, actions, mode: "paint", window: fakeWindow });

      ctrl.destroy();
      fakeWindow.dispatch("keydown", { key: "Shift", repeat: false, target: null });

      assert.strictEqual(calls.onShiftDown.length, 0);
    });
  });
});
