// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  KeyBindings,
  type KeyCode
} from "@jolly-pixel/controls";
import {
  VoxelTransform,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { mapHistoryOf } from "../../helpers/mapHistory.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { bindPlacementShortcuts } from "../../../src/features/placement/placementShortcuts.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { mapDocumentOf } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

function setup() {
  const keyboard = new KeyBindings();
  const world = new VoxelWorld();
  world.addLayer("Draft");
  world.setVoxelBulk("Draft", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    }
  ]);
  const templateId = world.templates.createFromLayer("Draft", {
    name: "House"
  })!.id;
  const store = new MapPlacement({
    world,
    history: mapHistoryOf(world),
    selection: new SelectionStore(),
    mapDocument: mapDocumentOf(world),
    access: mapAccess()
  });
  let commits = 0;
  const release = bindPlacementShortcuts({
    keyboard,
    placement: {
      get placing() {
        return store.placing;
      },
      turn: (transform) => store.turn(transform),
      commit: () => {
        commits++;

        return store.cancel();
      },
      cancel: () => store.cancel()
    }
  });

  function begin(): void {
    store.placeTemplate(templateId, { x: 0, y: 0, z: 0 });
  }

  function press(
    code: KeyCode,
    init: KeyboardEventInit = {}
  ): void {
    keyboard.dispatch(new KeyboardEvent("keydown", {
      code,
      ...init
    }));
  }

  return {
    keyboard,
    store,
    begin,
    release,
    press,
    commits: () => commits
  };
}

function rotation(
  store: MapPlacement
): number | undefined {
  return store.current?.placement.transform.rotation;
}

describe("PlacementShortcuts", () => {
  test("Q and E turn the pending placement in opposite directions", () => {
    const { store, begin, press } = setup();
    begin();

    press("KeyQ");
    assert.equal(rotation(store), 1);

    press("KeyE");
    press("KeyE");
    assert.equal(rotation(store), 3);
  });

  test("Enter and NumpadEnter commit the pending placement", () => {
    const { store, begin, press, commits } = setup();
    begin();
    press("Enter");
    begin();
    press("NumpadEnter");

    assert.equal(commits(), 2);
    assert.equal(store.current, null);
  });

  test("leaves Enter to a focused button", () => {
    const { keyboard, store, begin, commits } = setup();
    begin();
    const button = document.createElement("button");
    document.body.append(button);
    button.addEventListener("keydown", (event) => keyboard.dispatch(event));

    button.dispatchEvent(new KeyboardEvent("keydown", {
      code: "Enter",
      bubbles: true,
      composed: true
    }));
    button.remove();

    assert.equal(commits(), 0);
    assert.notEqual(store.current, null);
  });

  test("does nothing without a pending placement", () => {
    const { store, press, commits } = setup();

    press("KeyQ");
    press("Enter");

    assert.equal(store.current, null);
    assert.equal(commits(), 0);
  });

  test("ignores held keys and modifiers", () => {
    const { store, begin, press, commits } = setup();
    begin();

    press("KeyQ", { repeat: true });
    press("KeyQ", { ctrlKey: true });
    press("KeyE", { shiftKey: true });
    press("Enter", { repeat: true });
    press("Enter", { ctrlKey: true });

    assert.equal(store.current?.placement.transform, VoxelTransform.Identity);
    assert.equal(commits(), 0);
  });

  test("Escape cancels the pending placement before lower-priority bindings", () => {
    const { keyboard, store, begin, press } = setup();
    const fallbacks: string[] = [];
    keyboard.bind("Escape", () => {
      fallbacks.push("camera");
    });
    begin();

    press("Escape");
    assert.equal(store.current, null);
    assert.deepEqual(fallbacks, []);

    press("Escape");
    assert.deepEqual(fallbacks, ["camera"]);
  });

  test("stops listening once disposed", () => {
    const { store, begin, release, press } = setup();
    begin();

    release();
    press("KeyQ");

    assert.equal(rotation(store), 0);
  });
});
