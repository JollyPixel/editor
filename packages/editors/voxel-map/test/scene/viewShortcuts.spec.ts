// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  KeyBindings,
  type KeyCode
} from "@jolly-pixel/controls";
import { Preferences } from "@jolly-pixel/editor.host/preferences";
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { defaultKeyBindings } from "../helpers/shortcuts.ts";
import { createMapDocument } from "../helpers/mapDocument.ts";
import { mapAccess } from "../helpers/mapAccess.ts";
import { MapLayers } from "../../src/features/layers/MapLayers.ts";
import { viewShortcuts } from "../../src/scene/viewShortcuts.ts";
import {
  EditContext,
  ObjectLayerRef,
  SelectionStore,
  ViewStore
} from "../../src/state/index.ts";

function setup() {
  const keyboard = new KeyBindings();
  const world = new VoxelWorld();
  world.addLayer("Ground");
  world.addLayer("Tower");
  world.addLayer("Hidden");
  world.setVoxelBulk("Ground", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    }
  ]);
  world.setVoxelBulk("Tower", [
    {
      position: { x: 4, y: 3, z: 2 },
      blockId: 1
    }
  ]);
  world.setVoxelBulk("Hidden", [
    {
      position: { x: 40, y: 0, z: 0 },
      blockId: 1
    }
  ]);
  world.getLayer("Hidden")!.visible = false;
  world.objectLayers.add("Triggers");
  world.objectLayers.addObject("Triggers", {
    id: "obj_1",
    name: "Area",
    visible: true,
    x: 20,
    y: 0,
    z: 0
  });
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    editContext: new EditContext(),
    selection,
    mapDocument: createMapDocument(world),
    access: mapAccess()
  });
  const view = new ViewStore(new Preferences());
  const settings = defaultKeyBindings();
  const framed: Array<THREE.Box3 | null> = [];
  settings.bind(keyboard, viewShortcuts({
    view,
    camera: {
      frame: (bounds) => framed.push(bounds)
    },
    world,
    layers,
    selection
  }));

  function press(
    code: KeyCode
  ): boolean {
    return keyboard.dispatch(new KeyboardEvent("keydown", {
      code,
      key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
      cancelable: true
    }));
  }

  return {
    selection,
    layers,
    view,
    settings,
    framed,
    press
  };
}

describe("ViewShortcuts", () => {
  test("F frames the selected voxel layer", () => {
    const { selection, framed, press } = setup();
    selection.selectVoxelLayer("Tower");

    press("KeyF");

    assert.deepEqual(framed, [
      new THREE.Box3(
        new THREE.Vector3(4, 3, 2),
        new THREE.Vector3(5, 4, 3)
      )
    ]);
  });

  test("F frames the selected object layer like its Frame menu item", () => {
    const { selection, layers, framed, press } = setup();
    const triggers = new ObjectLayerRef("Triggers");
    selection.current = triggers;

    press("KeyF");

    const expected = layers.bounds(triggers);
    assert.ok(expected !== null && expected.min.x >= 20);
    assert.deepEqual(framed, [expected]);
  });

  test("F frames every visible layer without a selection", () => {
    const { selection, framed, press } = setup();
    selection.reconcile([]);

    press("KeyF");

    assert.deepEqual(framed, [
      new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(5, 4, 3)
      )
    ]);
  });

  test("view toggles stay unbound until a shortcut is assigned", () => {
    const { view, settings, press } = setup();

    assert.equal(press("Digit1"), false);

    settings.assign("view.grid", ["Digit1"]);
    settings.assign("view.inspector", ["Digit2"]);
    press("Digit1");
    press("Digit2");
    press("Digit2");

    assert.equal(view.settings.grid, false);
    assert.equal(view.settings.inspector, "wireframe");
  });
});
