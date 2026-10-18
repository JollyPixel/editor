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
import {
  createWorldHistory,
  mapSteps
} from "../../helpers/mapHistory.ts";
import { MapPlacement } from "../../../src/features/placement/MapPlacement.ts";
import { bindPlacementShortcuts } from "../../../src/features/placement/placementShortcuts.ts";
import type { HorizontalAxis } from "../../../src/scene/camera/EditorCamera.ts";
import { SelectionStore } from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";
import { defaultKeyBindings } from "../../helpers/shortcuts.ts";

function setup(
  rightAxis: HorizontalAxis = "x"
) {
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
    history: mapSteps(createWorldHistory(world)),
    selection: new SelectionStore(),
    mapDocument: createMapDocument(world),
    access: mapAccess()
  });
  let commits = 0;
  const release = bindPlacementShortcuts({
    keyboard,
    keyBindings: defaultKeyBindings(),
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
    },
    rightAxis: () => rightAxis
  });

  function begin(): void {
    store.placeTemplate(templateId, { x: 0, y: 0, z: 0 });
  }

  function press(
    code: KeyCode,
    init: KeyboardEventInit = {}
  ): boolean {
    return keyboard.dispatch(new KeyboardEvent("keydown", {
      code,
      key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
      cancelable: true,
      ...init
    }));
  }

  function transform(): VoxelTransform | undefined {
    return store.current?.placement.transform;
  }

  return {
    keyboard,
    store,
    begin,
    release,
    press,
    transform,
    commits: () => commits
  };
}

describe("PlacementShortcuts", () => {
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

    press("Enter");

    assert.equal(store.current, null);
    assert.equal(commits(), 0);
  });

  test("ignores held keys and modifiers", () => {
    const { store, begin, press, commits } = setup();
    begin();

    press("Enter", { repeat: true });
    press("Enter", { ctrlKey: true });

    assert.notEqual(store.current, null);
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
    const { store, begin, release, press, commits } = setup();
    begin();

    release();
    press("Enter");
    press("Escape");

    assert.equal(commits(), 0);
    assert.notEqual(store.current, null);
  });
});

describe("PlacementShortcuts orientation", () => {
  test("Q and E turn the placement like the rotate buttons", () => {
    const { begin, press, transform } = setup();
    begin();

    press("KeyQ");
    assert.equal(transform()?.rotation, 1);

    press("KeyE");
    press("KeyE");
    assert.equal(transform()?.rotation, 3);
  });

  test("V mirrors along Y and H along the camera's right axis", () => {
    const { begin, press, transform } = setup("z");
    begin();

    press("KeyV");
    press("KeyH");

    const expected = new VoxelTransform({ flipY: true })
      .followedBy(new VoxelTransform({ flipZ: true }));
    assert.ok(transform()?.equals(expected));
  });

  test("takes Q before lower-priority bindings, and passes it on without a placement", () => {
    const { keyboard, begin, press } = setup();
    const fallbacks: string[] = [];
    keyboard.bind("KeyQ", () => {
      fallbacks.push("brush");
    });

    assert.equal(press("KeyH"), false);
    press("KeyQ");
    begin();
    press("KeyQ");

    assert.deepEqual(fallbacks, ["brush"]);
  });
});
