// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  Keyboard,
  type KeyCode
} from "@jolly-pixel/controls";
import { VoxelTransform } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { PlacementStore } from "../../../src/features/placement/PlacementStore.ts";
import { TemplateSource } from "../../../src/features/placement/PlacementSource.ts";
import { bindPlacementShortcuts } from "../../../src/features/placement/placementShortcuts.ts";

function setup() {
  const keyboard = new Keyboard();
  const store = new PlacementStore();
  let commits = 0;
  const release = bindPlacementShortcuts({
    keyboard,
    placement: {
      store,
      commit: () => {
        commits++;
        store.end();

        return true;
      },
      cancel: () => {
        const placing = store.placing;
        store.end();

        return placing;
      }
    }
  });

  function press(
    code: KeyCode,
    init: KeyboardEventInit = {}
  ): void {
    keyboard.emit(code, new KeyboardEvent("keydown", {
      code,
      ...init
    }));
  }

  return {
    keyboard,
    store,
    release,
    press,
    commits: () => commits
  };
}

function begin(
  store: PlacementStore
): void {
  store.begin(new TemplateSource("house"), { x: 0, y: 0, z: 0 });
}

function rotation(
  store: PlacementStore
): number | undefined {
  return store.placement?.transform.rotation;
}

describe("PlacementShortcuts", () => {
  test("Q and E turn the pending placement in opposite directions", () => {
    const { store, press } = setup();
    begin(store);

    press("KeyQ");
    assert.equal(rotation(store), 1);

    press("KeyE");
    press("KeyE");
    assert.equal(rotation(store), 3);
  });

  test("Enter and NumpadEnter commit the pending placement", () => {
    const { store, press, commits } = setup();
    begin(store);
    press("Enter");
    begin(store);
    press("NumpadEnter");

    assert.equal(commits(), 2);
    assert.equal(store.placement, null);
  });

  test("leaves Enter to a focused button", () => {
    const { keyboard, store, commits } = setup();
    begin(store);
    const button = document.createElement("button");
    document.body.append(button);
    button.addEventListener("keydown", (event) => keyboard.emit("Enter", event));

    button.dispatchEvent(new KeyboardEvent("keydown", {
      code: "Enter",
      bubbles: true,
      composed: true
    }));
    button.remove();

    assert.equal(commits(), 0);
    assert.notEqual(store.placement, null);
  });

  test("does nothing without a pending placement", () => {
    const { store, press, commits } = setup();

    press("KeyQ");
    press("Enter");

    assert.equal(store.placement, null);
    assert.equal(commits(), 0);
  });

  test("ignores held keys and modifiers", () => {
    const { store, press, commits } = setup();
    begin(store);

    press("KeyQ", { repeat: true });
    press("KeyQ", { ctrlKey: true });
    press("KeyE", { shiftKey: true });
    press("Enter", { repeat: true });
    press("Enter", { ctrlKey: true });

    assert.equal(store.placement?.transform, VoxelTransform.Identity);
    assert.equal(commits(), 0);
  });

  test("Escape cancels the pending placement before lower-priority bindings", () => {
    const { keyboard, store, press } = setup();
    const fallbacks: string[] = [];
    keyboard.bind("Escape", () => {
      fallbacks.push("camera");
    });
    begin(store);

    press("Escape");
    assert.equal(store.placement, null);
    assert.deepEqual(fallbacks, []);

    press("Escape");
    assert.deepEqual(fallbacks, ["camera"]);
  });

  test("stops listening once disposed", () => {
    const { store, release, press } = setup();
    begin(store);

    release();
    press("KeyQ");

    assert.equal(rotation(store), 0);
  });
});
