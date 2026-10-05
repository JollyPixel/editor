// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  isApplePlatform,
  KeyBindingMap
} from "@jolly-pixel/controls";
import type { CanvasShortcuts } from "@jolly-pixel/pixel-draw.renderer";
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  CANVAS_HOVER_CHANGE_EVENT,
  CanvasKeyboardController,
  type CanvasHoverChangeDetail
} from "../../src/keybindings/CanvasKeyboardController.ts";
import { PIXEL_ART_KEY_BINDINGS } from "../../src/keybindings/pixelArtKeyBindings.ts";

// CONSTANTS
const kMod: KeyboardEventInit = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };

class FakeShortcuts implements CanvasShortcuts {
  readonly calls: string[] = [];
  handles = true;
  panHeld = false;
  lineHeld = false;

  #record(
    name: string
  ): boolean {
    this.calls.push(name);

    return this.handles;
  }

  selectAll() {
    return this.#record("selectAll");
  }

  copy() {
    return this.#record("copy");
  }

  paste() {
    return this.#record("paste");
  }

  delete() {
    return this.#record("delete");
  }

  undo() {
    return this.#record("undo");
  }

  redo() {
    return this.#record("redo");
  }

  rotate(
    direction: "cw" | "ccw"
  ) {
    return this.#record(`rotate:${direction}`);
  }

  flipHorizontal() {
    return this.#record("flipHorizontal");
  }

  flipVertical() {
    return this.#record("flipVertical");
  }
}

class StubHost extends EventTarget implements ReactiveControllerHost {
  readonly controllers: ReactiveController[] = [];
  readonly updateComplete = Promise.resolve(true);

  addController(
    controller: ReactiveController
  ): void {
    this.controllers.push(controller);
  }

  removeController(): void {
    return undefined;
  }

  requestUpdate(): void {
    return undefined;
  }
}

function press(
  type: "keydown" | "keyup",
  init: KeyboardEventInit,
  target: EventTarget = document
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init
  });
  target.dispatchEvent(event);

  return event;
}

describe("CanvasKeyboardController", () => {
  let active: FakeShortcuts | null;
  let claimed: boolean;
  let host: StubHost;
  let controller: CanvasKeyboardController;

  beforeEach(() => {
    active = new FakeShortcuts();
    claimed = false;
    host = new StubHost();
    controller = new CanvasKeyboardController(host, () => active, {
      guard: {
        blocks: () => claimed
      }
    });
    controller.hostConnected();
    controller.hover(true);
  });

  afterEach(() => {
    controller.hostDisconnected();
    document.body.replaceChildren();
  });

  test("routes the default chords to the active canvas shortcuts", () => {
    const shortcuts = active!;

    press("keydown", { key: "z", code: "KeyZ", ...kMod });
    press("keydown", { key: "Z", code: "KeyZ", shiftKey: true, ...kMod });
    press("keydown", { key: "R", code: "KeyR", shiftKey: true });
    press("keydown", { key: "h", code: "KeyH" });
    press("keydown", { key: "Delete", code: "Delete" });

    assert.deepEqual(shortcuts.calls, [
      "undo",
      "redo",
      "rotate:ccw",
      "flipHorizontal",
      "delete"
    ]);
  });

  test("a letter chord follows the printed letter, not the key position", () => {
    const shortcuts = active!;

    press("keydown", { key: "z", code: "KeyW", ...kMod });

    assert.deepEqual(shortcuts.calls, ["undo"]);
  });

  test("an unhandled shortcut keeps the browser default", () => {
    active!.handles = false;

    const handled = press("keydown", { key: "c", code: "KeyC", ...kMod });
    const ignored = press("keydown", { key: "F5", code: "F5" });

    assert.equal(handled.defaultPrevented, false);
    assert.equal(ignored.defaultPrevented, false);
  });

  test("hover() reports the change on the host", () => {
    const reported: boolean[] = [];
    host.addEventListener(CANVAS_HOVER_CHANGE_EVENT, (event) => {
      if (event instanceof CustomEvent) {
        const detail: CanvasHoverChangeDetail = event.detail;
        reported.push(detail.hovering);
      }
    });

    controller.hover(false);
    controller.hover(true);

    assert.deepEqual(reported, [false, true]);
  });

  test("ignores keys while the pointer is off the canvas", () => {
    controller.hover(false);

    press("keydown", { key: "z", code: "KeyZ", ...kMod });
    press("keydown", { key: " ", code: "Space" });

    assert.deepEqual(active!.calls, []);
    assert.equal(active!.panHeld, false);
  });

  test("ignores keys claimed by an input layer", () => {
    claimed = true;

    press("keydown", { key: "z", code: "KeyZ", ...kMod });

    assert.deepEqual(active!.calls, []);
  });

  test("ignores keys typed in a text field but not on a slider", () => {
    const text = document.createElement("input");
    const range = document.createElement("input");
    range.type = "range";
    document.body.append(text, range);

    press("keydown", { key: "z", code: "KeyZ", ...kMod }, text);
    press("keydown", { key: "z", code: "KeyZ", ...kMod }, range);

    assert.deepEqual(active!.calls, ["undo"]);
  });

  test("Space holds the pan modifier and suppresses page scrolling", () => {
    const shortcuts = active!;

    const keydown = press("keydown", { key: " ", code: "Space" });
    assert.equal(keydown.defaultPrevented, true);
    assert.equal(shortcuts.panHeld, true);

    controller.hover(false);
    press("keyup", { key: " ", code: "Space" });
    assert.equal(shortcuts.panHeld, false);
  });

  test("Shift holds the line modifier on the canvas that saw it pressed", () => {
    const first = active!;

    press("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true });
    active = new FakeShortcuts();
    press("keyup", { key: "Shift", code: "ShiftLeft" });

    assert.equal(first.lineHeld, false);
    assert.deepEqual(active.calls, []);
  });

  test("a new key binding map replaces the previous chords", () => {
    controller.keyBindings = new KeyBindingMap(PIXEL_ART_KEY_BINDINGS, {
      undo: "Mod+u"
    });

    press("keydown", { key: "z", code: "KeyZ", ...kMod });
    press("keydown", { key: "u", code: "KeyU", ...kMod });

    assert.deepEqual(active!.calls, ["undo"]);
  });

  test("does nothing without an active canvas", () => {
    active = null;

    const event = press("keydown", { key: "z", code: "KeyZ", ...kMod });

    assert.equal(event.defaultPrevented, false);
  });

  test("stops listening and releases held modifiers on disconnect", () => {
    const shortcuts = active!;
    press("keydown", { key: " ", code: "Space" });

    controller.hostDisconnected();
    press("keydown", { key: "z", code: "KeyZ", ...kMod });
    controller.hostConnected();

    assert.equal(shortcuts.panHeld, false);
    assert.deepEqual(shortcuts.calls, []);
  });
});
