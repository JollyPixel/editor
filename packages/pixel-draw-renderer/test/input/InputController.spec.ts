// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  InputController,
  type WindowLike
} from "#src/input/InputController.ts";
import { Viewport } from "#src/rendering/Viewport.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import {
  shiftKeyDown,
  shiftKeyUp,
  moveTo,
  hoverCanvas
} from "../helpers/events.ts";

/**
 * Minimal WindowLike fake — proves InputController never touches the real
 * global `window` when one is injected via options.window.
 */
class FakeWindow implements WindowLike {
  #listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(
    type: string,
    listener: (event: any) => void
  ): void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: any) => void
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("InputController", () => {
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

  describe("mouse events", () => {
    test("mousedown (left button) triggers onPrimaryDown with the resolved texture position", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
      ctrl.destroy();
    });

    test("mousemove does NOT trigger onPrimaryMove when not dragging", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(new MouseEvent("mousemove", {
        buttons: 0,
        clientX: 50,
        clientY: 50,
        bubbles: true
      }));

      assert.strictEqual(calls.onPrimaryMove.length, 0);
      ctrl.destroy();
    });

    test("dragging after mousedown fires onPrimaryMove", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
        buttons: 1,
        clientX: 110,
        clientY: 100,
        bubbles: true
      }));

      assert.strictEqual(calls.onPrimaryMove.length, 1);
      ctrl.destroy();
    });

    test("mouseup ends a tracked gesture with onPrimaryUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      assert.strictEqual(calls.onPrimaryUp.length, 1);
      ctrl.destroy();
    });

    test("mousedown with middle button triggers pan", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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

    test("mouseleave triggers onMouseMove(-1, -1)", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );
      const last = calls.onMouseMove.at(-1);
      assert.ok(last !== undefined);
      assert.strictEqual(last[0], -1);
      assert.strictEqual(last[1], -1);
      ctrl.destroy();
    });
  });

  describe("contextmenu", () => {
    test("right-click suppresses the browser context menu and triggers no action", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
        onMouseMove: [],
        onCursorMove: [],
        onMouseUp: [],
        onShiftDown: [],
        onShiftUp: [],
        onSpaceDown: [],
        onSpaceUp: [],
        onBlur: [],
        onCopy: [],
        onPaste: [],
        onDelete: [],
        onUndo: [],
        onRedo: [],
        onRotate: [],
        onFlipHorizontal: [],
        onFlipVertical: []
      });
      ctrl.destroy();
    });
  });

  describe("destroy", () => {
    test("removes event listeners — no callbacks after destroy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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

  describe("onCursorMove", () => {
    // With this viewport (200x200 canvas, 16x16 texture, zoom 4), the
    // texture is centered with camera = (68, 68). client(100,100) -> texture
    // (8,8).

    test("fires with the resolved texture position on mousemove", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 100, 100);

      assert.strictEqual(
        calls.onCursorMove.length,
        1
      );
      assert.deepStrictEqual(
        calls.onCursorMove[0][0],
        { x: 8, y: 8 }
      );
      ctrl.destroy();
    });

    test("fires with null when the cursor is outside texture bounds", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 1000, 1000);

      assert.strictEqual(
        calls.onCursorMove.length,
        1
      );
      assert.strictEqual(
        calls.onCursorMove[0][0],
        null
      );
      ctrl.destroy();
    });

    test("fires with null on mouseleave", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      moveTo(canvas, 100, 100);
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );

      assert.strictEqual(
        calls.onCursorMove.at(-1)?.[0],
        null
      );
      ctrl.destroy();
    });
  });

  describe("onMouseUp", () => {
    test("fires on canvas mouseup even when nothing was being tracked", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      canvas.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });

    test("fires on window mouseup", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("onPrimaryDown return value", () => {
    test("returning false prevents onPrimaryMove/onPrimaryUp from firing for that gesture", () => {
      const { actions, calls } = makeActions({ onPrimaryDownReturns: false });
      const ctrl = new InputController({
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

    test("returning undefined (default) tracks the gesture normally", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
    test("stops tracking the current gesture — no further onPrimaryMove/onPrimaryUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
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
      // onMouseUp is unconditional and still fires — consumers decide what it means.
      assert.strictEqual(calls.onMouseUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("Shift key reporting", () => {
    test("a non-repeat Shift keydown fires onShiftDown while hovering the canvas", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("OS key-repeat keydown does not fire onShiftDown again", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(shiftKeyDown());
      window.dispatchEvent(shiftKeyDown(true));

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("keydown while a text input has focus does not fire onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const input = document.createElement("input");
      document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 0);
      ctrl.destroy();
    });

    test("keydown while a range input has focus still fires onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const input = document.createElement("input");
      input.type = "range";
      document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("keydown while a color input has focus still fires onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      const input = document.createElement("input");
      input.type = "color";
      document.body.appendChild(input);

      input.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("a non-Shift key does not fire onShiftDown/onShiftUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Control",
          bubbles: true
        })
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Control",
          bubbles: true
        })
      );

      assert.strictEqual(calls.onShiftDown.length, 0);
      assert.strictEqual(calls.onShiftUp.length, 0);
      ctrl.destroy();
    });

    test("Shift keyup fires onShiftUp", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(shiftKeyUp());

      assert.strictEqual(calls.onShiftUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("keyboard shortcuts gated to canvas hover", () => {
    test("Shift keydown before any mouseenter does not fire onShiftDown", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 0);
      ctrl.destroy();
    });

    test("Ctrl+C before any mouseenter does not fire onCopy", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "c",
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        })
      );

      assert.strictEqual(calls.onCopy.length, 0);
      ctrl.destroy();
    });

    test("mouseleave stops keydown shortcuts from firing again", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );
      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 0);
      ctrl.destroy();
    });

    test("re-entering the canvas after a mouseleave re-enables shortcuts", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );
      hoverCanvas(canvas);
      window.dispatchEvent(shiftKeyDown());

      assert.strictEqual(calls.onShiftDown.length, 1);
      ctrl.destroy();
    });

    test("keyup (e.g. Shift release) is not gated by hover", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      hoverCanvas(canvas);
      window.dispatchEvent(shiftKeyDown());
      canvas.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: true })
      );
      window.dispatchEvent(shiftKeyUp());

      assert.strictEqual(calls.onShiftUp.length, 1);
      ctrl.destroy();
    });
  });

  describe("onBlur", () => {
    test("window blur fires onBlur", () => {
      const { actions, calls } = makeActions();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions
      });

      window.dispatchEvent(
        new Event("blur")
      );

      assert.strictEqual(calls.onBlur.length, 1);
      ctrl.destroy();
    });
  });

  describe("injected window", () => {
    test("keydown/keyup/blur are read from the injected window, not the real global", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions,
        window: fakeWindow
      });

      hoverCanvas(canvas);

      window.dispatchEvent(shiftKeyDown());
      assert.strictEqual(calls.onShiftDown.length, 0);

      fakeWindow.dispatch(
        "keydown",
        { key: "Shift", repeat: false, target: null }
      );
      assert.strictEqual(calls.onShiftDown.length, 1);

      fakeWindow.dispatch(
        "keyup",
        { key: "Shift" }
      );
      assert.strictEqual(calls.onShiftUp.length, 1);

      fakeWindow.dispatch(
        "blur"
      );
      assert.strictEqual(calls.onBlur.length, 1);

      ctrl.destroy();
    });

    test("mouseup on the injected window ends an in-progress gesture", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({
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
      fakeWindow.dispatch("mouseup");

      assert.strictEqual(calls.onPrimaryUp.length, 1);
      ctrl.destroy();
    });

    test("destroy() detaches from the injected window", () => {
      const { actions, calls } = makeActions();
      const fakeWindow = new FakeWindow();
      const ctrl = new InputController({
        canvas,
        viewport,
        actions,
        window: fakeWindow
      });

      ctrl.destroy();
      fakeWindow.dispatch(
        "keydown",
        { key: "Shift", repeat: false, target: null }
      );

      assert.strictEqual(calls.onShiftDown.length, 0);
    });
  });
});
