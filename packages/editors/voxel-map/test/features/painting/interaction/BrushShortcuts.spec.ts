// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BrushStore,
  SelectionStore
} from "../../../../src/app/state/index.ts";
import {
  BRUSH_SHORTCUT_CODES,
  BrushShortcuts,
  nextAxis,
  type BrushShortcutsOptions
} from "../../../../src/features/painting/interaction/BrushShortcuts.ts";

type KeyListener = (event: KeyboardEvent) => void;

interface KeyPress {
  code: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  path?: EventTarget[];
}

function createKeyboard() {
  const listeners = new Map<string, KeyListener>();
  const keyboard: BrushShortcutsOptions["keyboard"] = {
    on(code: string, listener: KeyListener) {
      listeners.set(code, listener);

      return keyboard;
    },
    off(code: string) {
      listeners.delete(code);

      return keyboard;
    }
  } as unknown as BrushShortcutsOptions["keyboard"];

  return {
    keyboard,
    listeners,
    press(press: KeyPress): boolean {
      let prevented = false;
      const event = {
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        repeat: false,
        ...press,
        composedPath: () => press.path ?? [],
        preventDefault: () => {
          prevented = true;
        }
      } as unknown as KeyboardEvent;
      listeners.get(press.code)?.(event);

      return prevented;
    }
  };
}

function setup(
  voxelLayer: string | null = "Ground"
) {
  const input = createKeyboard();
  const brush = new BrushStore();
  const selection = new SelectionStore();
  if (voxelLayer !== null) {
    selection.selectVoxelLayer(voxelLayer);
  }
  const shortcuts = new BrushShortcuts({
    keyboard: input.keyboard,
    brush,
    selection
  });

  return {
    ...input,
    brush,
    selection,
    shortcuts
  };
}

describe("BrushShortcuts", () => {
  test("listens to every brush key and stops on dispose", () => {
    const { listeners, shortcuts } = setup();

    assert.deepEqual([...listeners.keys()], [...BRUSH_SHORTCUT_CODES]);

    shortcuts.dispose();

    assert.equal(listeners.size, 0);
  });

  test("R toggles build and replace", () => {
    const { brush, press } = setup();

    assert.equal(press({ code: "KeyR" }), true);
    assert.equal(brush.mode, "replace");
    press({ code: "KeyR" });
    assert.equal(brush.mode, "build");
  });

  test("X cycles the axis and wraps", () => {
    const { brush, press } = setup();
    const seen: string[] = [];

    for (let index = 0; index < 4; index++) {
      press({ code: "KeyX" });
      seen.push(brush.axis);
    }

    assert.deepEqual(seen, ["xy", "yz", "xyz", "xz"]);
  });

  test("C toggles square and circle", () => {
    const { brush, press } = setup();

    press({ code: "KeyC" });
    assert.equal(brush.pattern, "circle");
    press({ code: "KeyC" });
    assert.equal(brush.pattern, "square");
  });

  test("brackets resize within bounds and repeat while held", () => {
    const { brush, press } = setup();

    press({ code: "BracketRight" });
    press({ code: "BracketRight", repeat: true });
    assert.equal(brush.size, 3);

    press({ code: "BracketLeft" });
    press({ code: "BracketLeft" });
    press({ code: "BracketLeft" });
    assert.equal(brush.size, 1);
  });

  test("ignores a held toggle key", () => {
    const { brush, press } = setup();

    press({ code: "KeyR", repeat: true });

    assert.equal(brush.mode, "build");
  });

  test("leaves modifier combinations alone", () => {
    const { brush, press } = setup();

    for (const modifier of ["ctrlKey", "altKey", "shiftKey", "metaKey"]) {
      assert.equal(press({ code: "KeyC", [modifier]: true }), false);
    }

    assert.equal(brush.pattern, "square");
  });

  test("does nothing while no voxel layer is selected", () => {
    const { brush, press, selection } = setup(null);

    press({ code: "KeyR" });
    selection.selectObjectLayer("Objects");
    press({ code: "KeyX" });

    assert.equal(brush.mode, "build");
    assert.equal(brush.axis, "xz");
  });

  test("does nothing while a dialog is open", () => {
    const { brush, press } = setup();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");

    press({ code: "KeyR", path: [document.createElement("input"), dialog] });

    assert.equal(brush.mode, "build");
  });

  test("nextAxis follows the toolbar order", () => {
    assert.equal(nextAxis("xz"), "xy");
    assert.equal(nextAxis("xyz"), "xz");
  });
});
