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
import {
  InvalidKeybindingError,
  KeybindingConflictError
} from "../../src/utils/keybindings.ts";

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

function hoverCanvas(canvas: HTMLCanvasElement): void {
  canvas.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
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

function keydown(
  key: string,
  code: string,
  parameters: { ctrlKey?: boolean; altKey?: boolean; } = {}
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    code,
    ctrlKey: parameters.ctrlKey ?? false,
    altKey: parameters.altKey ?? false,
    bubbles: true,
    cancelable: true
  });
}

function makeActions(): {
  actions: InputActions;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    onPrimaryDown: [], onPrimaryMove: [], onPrimaryUp: [],
    onPanStart: [], onPanMove: [], onPanEnd: [],
    onZoom: [], onColorPick: [], onMouseMove: [],
    onCursorMove: [], onMouseUp: [],
    onShiftDown: [], onShiftUp: [], onBlur: [],
    onCopy: [], onPaste: [], onDelete: [],
    onUndo: [], onRedo: [],
    onRotate: [], onFlipHorizontal: [], onFlipVertical: []
  };

  const actions: InputActions = {
    onPrimaryDown: (tx, ty) => {
      calls.onPrimaryDown.push([tx, ty]);
    },
    onPrimaryMove: (tx, ty) => {
      calls.onPrimaryMove.push([tx, ty]);
    },
    onPrimaryUp: () => {
      calls.onPrimaryUp.push([]);
    },
    onPanStart: (mx, my) => {
      calls.onPanStart.push([mx, my]);
    },
    onPanMove: (dx, dy) => {
      calls.onPanMove.push([dx, dy]);
    },
    onPanEnd: () => {
      calls.onPanEnd.push([]);
    },
    onZoom: (d, cx, cy) => {
      calls.onZoom.push([d, cx, cy]);
    },
    onColorPick: (tx, ty) => {
      calls.onColorPick.push([tx, ty]);
    },
    onMouseMove: (cx, cy) => {
      calls.onMouseMove.push([cx, cy]);
    },
    onCursorMove: (pos) => {
      calls.onCursorMove.push([pos]);
    },
    onMouseUp: () => {
      calls.onMouseUp.push([]);
    },
    onShiftDown: () => {
      calls.onShiftDown.push([]);
    },
    onShiftUp: () => {
      calls.onShiftUp.push([]);
    },
    onBlur: () => {
      calls.onBlur.push([]);
    },
    onCopy: () => {
      calls.onCopy.push([]);
    },
    onPaste: () => {
      calls.onPaste.push([]);
    },
    onDelete: () => {
      calls.onDelete.push([]);
    },
    onUndo: () => {
      calls.onUndo.push([]);
    },
    onRedo: () => {
      calls.onRedo.push([]);
    },
    onRotate: () => {
      calls.onRotate.push([]);
    },
    onFlipHorizontal: () => {
      calls.onFlipHorizontal.push([]);
    },
    onFlipVertical: () => {
      calls.onFlipVertical.push([]);
    }
  };

  return { actions, calls };
}

describe("InputController custom keybindings", () => {
  let viewport: Viewport;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    viewport = new Viewport({ textureSize: { x: 16, y: 16 }, zoom: 4 });
    viewport.updateCanvasSize(200, 200);
    viewport.centerTexture();
  });

  test("constructor keybindings option overrides the default undo combo", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas, viewport, actions, keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("u", "KeyU", { altKey: true }));

    assert.strictEqual(calls.onUndo.length, 1);
    ctrl.destroy();
  });

  test("constructor keybindings option disables the default combo for the overridden action", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas, viewport, actions, keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("z", "KeyZ", { ctrlKey: true }));

    assert.strictEqual(calls.onUndo.length, 0);
    ctrl.destroy();
  });

  test("unspecified actions keep their default binding", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas, viewport, actions, keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("c", "KeyC", { ctrlKey: true }));

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("constructor throws InvalidKeybindingError for a malformed binding", () => {
    const { actions } = makeActions();

    assert.throws(
      () => new InputController({ canvas, viewport, actions, keybindings: { undo: "ctl+z" as never } }),
      InvalidKeybindingError
    );
  });

  test("constructor throws KeybindingConflictError when two actions collide", () => {
    const { actions } = makeActions();

    assert.throws(
      () => new InputController({ canvas, viewport, actions, keybindings: { delete: "mod+c" } }),
      KeybindingConflictError
    );
  });

  test("keybindings returns the effective (merged) set", () => {
    const { actions } = makeActions();
    const ctrl = new InputController({
      canvas, viewport, actions, keybindings: { undo: "alt+u" }
    });

    const current = ctrl.keybindings;

    assert.strictEqual(current.undo, "alt+u");
    assert.strictEqual(current.copy, "mod+c");
    ctrl.destroy();
  });

  test("patchKeybindings merges onto the current set at runtime", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    ctrl.patchKeybindings({ copy: "alt+j" });
    hoverCanvas(canvas);
    window.dispatchEvent(keydown("c", "KeyC", { ctrlKey: true }));
    window.dispatchEvent(keydown("j", "KeyJ", { altKey: true }));

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("patchKeybindings throws on conflict and leaves the previous keybindings in effect", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    assert.throws(() => ctrl.patchKeybindings({ delete: "mod+c" }), KeybindingConflictError);

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("c", "KeyC", { ctrlKey: true }));

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("default 'r'/'h'/'v' keys fire onRotate/onFlipHorizontal/onFlipVertical", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("r", "KeyR"));
    window.dispatchEvent(keydown("h", "KeyH"));
    window.dispatchEvent(keydown("v", "KeyV"));

    assert.strictEqual(calls.onRotate.length, 1);
    assert.strictEqual(calls.onFlipHorizontal.length, 1);
    assert.strictEqual(calls.onFlipVertical.length, 1);
    ctrl.destroy();
  });

  test("constructor keybindings option overrides the default rotate combo", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas, viewport, actions, keybindings: { rotate: "alt+r" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("r", "KeyR"));
    window.dispatchEvent(keydown("r", "KeyR", { altKey: true }));

    assert.strictEqual(calls.onRotate.length, 1);
    ctrl.destroy();
  });

  test("matches by the character produced (event.key), not physical key position — correct on AZERTY", () => {
    // AZERTY: the physical key that produces the "z" character sits where
    // QWERTY has "W", so the browser reports key: "z", code: "KeyW". Undo
    // must still fire — matching on event.code here would require the
    // QWERTY-position Z key instead, which is the wrong key on this layout.
    const { actions, calls } = makeActions();
    const ctrl = new InputController({ canvas, viewport, actions });

    hoverCanvas(canvas);
    window.dispatchEvent(keydown("z", "KeyW", { ctrlKey: true }));

    assert.strictEqual(calls.onUndo.length, 1);
    ctrl.destroy();
  });
});
