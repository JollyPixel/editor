// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Runtime } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { EditorRuntime } from "#src/runtime/EditorRuntime.ts";

function hover(
  target: EventTarget,
  hovering: boolean
): void {
  target.dispatchEvent(new CustomEvent("canvas-hover-change", {
    detail: { hovering }
  }));
}

function fakeRuntime(
  keyboard: { enabled: boolean; }
): Runtime {
  const runtime = {
    world: {
      input: {
        keyboard
      }
    }
  };

  return runtime as unknown as Runtime;
}

describe("EditorRuntime.suspendKeyboardOnHover", () => {
  test("disables the keyboard while the target reports hovering", () => {
    const target = new EventTarget();
    const keyboard = { enabled: true };
    const editorRuntime = new EditorRuntime(fakeRuntime(keyboard));
    const stop = editorRuntime.suspendKeyboardOnHover(
      target,
      "canvas-hover-change"
    );

    hover(target, true);
    assert.equal(keyboard.enabled, false);
    hover(target, false);
    assert.equal(keyboard.enabled, true);

    stop();
    hover(target, true);
    assert.equal(keyboard.enabled, true);
  });
});
