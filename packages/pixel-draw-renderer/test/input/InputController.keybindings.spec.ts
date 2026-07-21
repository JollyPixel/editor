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
import {
  InvalidKeybindingError,
  KeybindingConflictError
} from "#src/input/Keybindings.ts";
import { makeActions } from "../helpers/input-actions.ts";
import { makeCanvas } from "../helpers/dom.ts";
import { hoverCanvas } from "../helpers/events.ts";

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

describe("InputController custom keybindings", () => {
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

  test("constructor keybindings option overrides the default undo combo", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions,
      keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("u", "KeyU", { altKey: true })
    );

    assert.strictEqual(calls.onUndo.length, 1);
    ctrl.destroy();
  });

  test("constructor keybindings option disables the default combo for the overridden action", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions,
      keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("z", "KeyZ", { ctrlKey: true })
    );

    assert.strictEqual(calls.onUndo.length, 0);
    ctrl.destroy();
  });

  test("unspecified actions keep their default binding", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions,
      keybindings: { undo: "alt+u" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("c", "KeyC", { ctrlKey: true })
    );

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("constructor throws InvalidKeybindingError for a malformed binding", () => {
    const { actions } = makeActions();

    assert.throws(
      () => new InputController({
        canvas,
        viewport,
        actions,
        keybindings: { undo: "ctl+z" as never }
      }),
      InvalidKeybindingError
    );
  });

  test("constructor throws KeybindingConflictError when two actions collide", () => {
    const { actions } = makeActions();

    assert.throws(
      () => new InputController({
        canvas,
        viewport,
        actions,
        keybindings: { delete: "mod+c" }
      }),
      KeybindingConflictError
    );
  });

  test("keybindings returns the effective (merged) set", () => {
    const { actions } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions,
      keybindings: { undo: "alt+u" }
    });

    const current = ctrl.keybindings.bindings;

    assert.strictEqual(current.undo, "alt+u");
    assert.strictEqual(current.copy, "mod+c");
    ctrl.destroy();
  });

  test("keybindings.patch merges onto the current set at runtime", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    ctrl.keybindings.patch({ copy: "alt+j" });
    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("c", "KeyC", { ctrlKey: true })
    );
    window.dispatchEvent(
      keydown("j", "KeyJ", { altKey: true })
    );

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("keybindings.patch throws on conflict and leaves the previous keybindings in effect", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    assert.throws(
      () => ctrl.keybindings.patch({ delete: "mod+c" }),
      KeybindingConflictError
    );

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("c", "KeyC", { ctrlKey: true })
    );

    assert.strictEqual(calls.onCopy.length, 1);
    ctrl.destroy();
  });

  test("default 'r'/'h'/'v' keys fire onRotate/onFlipHorizontal/onFlipVertical", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("r", "KeyR")
    );
    window.dispatchEvent(
      keydown("h", "KeyH")
    );
    window.dispatchEvent(
      keydown("v", "KeyV")
    );

    assert.strictEqual(calls.onRotate.length, 1);
    assert.strictEqual(calls.onFlipHorizontal.length, 1);
    assert.strictEqual(calls.onFlipVertical.length, 1);
    ctrl.destroy();
  });

  test("constructor keybindings option overrides the default rotate combo", () => {
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions,
      keybindings: { rotate: "alt+r" }
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("r", "KeyR")
    );
    window.dispatchEvent(
      keydown("r", "KeyR", { altKey: true })
    );

    assert.strictEqual(calls.onRotate.length, 1);
    ctrl.destroy();
  });

  test("matches by the character produced (event.key), not physical key position — correct on AZERTY", () => {
    // AZERTY: the physical key that produces the "z" character sits where
    // QWERTY has "W", so the browser reports key: "z", code: "KeyW". Undo
    // must still fire — matching on event.code here would require the
    // QWERTY-position Z key instead, which is the wrong key on this layout.
    const { actions, calls } = makeActions();
    const ctrl = new InputController({
      canvas,
      viewport,
      actions
    });

    hoverCanvas(canvas);
    window.dispatchEvent(
      keydown("z", "KeyW", { ctrlKey: true })
    );

    assert.strictEqual(calls.onUndo.length, 1);
    ctrl.destroy();
  });
});
