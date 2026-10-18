// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  LayerVisibilityStore
} from "../../../src/features/layers/LayerVisibilityStore.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  VoxelLayerRef,
  type LayerRef
} from "../../../src/state/index.ts";

// CONSTANTS
const kGround = new VoxelLayerRef("Ground");
const kDeco = new VoxelLayerRef("Deco");
const kTriggers = new ObjectLayerRef("Triggers");
const kDoor = new ObjectRef("Triggers", "door");
const kTrap = new ObjectRef("Triggers", "trap");
const kSpawns = new ObjectLayerRef("Spawns");
const kSpawn = new ObjectRef("Spawns", "spawn");
const kEntries: LayerRef[] = [kGround, kDeco, kTriggers, kDoor, kTrap, kSpawns, kSpawn];

function shown(
  store: LayerVisibilityStore
): Record<string, boolean | undefined> {
  return Object.fromEntries(
    kEntries.map((entry) => [entry.key, store.visibilityOverride(entry.key)])
  );
}

function recordChanges(
  store: LayerVisibilityStore
): string[] {
  const changes: string[] = [];
  store.subscribe("change", (key) => changes.push(key));

  return changes;
}

describe("LayerVisibilityStore", () => {
  test("falls back to the saved value without an override", () => {
    const store = new LayerVisibilityStore();

    assert.strictEqual(store.resolve("voxel:Ground", true), true);
    assert.strictEqual(store.resolve("voxel:Ground", false), false);
  });

  test("prefers the local override over the saved value", () => {
    const store = new LayerVisibilityStore();
    store.override("voxel:Ground", false);

    assert.strictEqual(store.resolve("voxel:Ground", true), false);
  });

  test("emits a change only when an override changes", () => {
    const store = new LayerVisibilityStore();
    const changes = recordChanges(store);

    store.override("voxel:Ground", false);
    store.override("voxel:Ground", false);
    store.override("voxel:Ground", true);

    assert.deepStrictEqual(changes, ["voxel:Ground", "voxel:Ground"]);
  });

  test("forgets an override and restores the saved value", () => {
    const store = new LayerVisibilityStore();
    store.override("voxel:Ground", false);
    const changes = recordChanges(store);

    store.forget("voxel:Ground");
    store.forget("voxel:Ground");

    assert.strictEqual(store.resolve("voxel:Ground", true), true);
    assert.deepStrictEqual(changes, ["voxel:Ground"]);
  });
});

describe("LayerVisibilityStore isolation", () => {
  test("shows only a layer and leaves the objects of other layers alone", () => {
    const store = new LayerVisibilityStore();
    store.override(kDeco.key, true);

    store.showOnly(kTriggers, kEntries);

    assert.deepStrictEqual(shown(store), {
      [kGround.key]: false,
      [kDeco.key]: false,
      [kTriggers.key]: true,
      [kDoor.key]: undefined,
      [kTrap.key]: undefined,
      [kSpawns.key]: false,
      [kSpawn.key]: undefined
    });
  });

  test("shows only an object, its layer, and hides its siblings", () => {
    const store = new LayerVisibilityStore();

    store.showOnly(kDoor, kEntries);

    assert.deepStrictEqual(shown(store), {
      [kGround.key]: false,
      [kDeco.key]: false,
      [kTriggers.key]: true,
      [kDoor.key]: true,
      [kTrap.key]: false,
      [kSpawns.key]: false,
      [kSpawn.key]: undefined
    });
  });

  test("shows every entry again", () => {
    const store = new LayerVisibilityStore();
    store.showOnly(kDoor, kEntries);

    store.showAll(kEntries);

    assert.ok(Object.values(shown(store)).every((visible) => visible === true));
  });
});
