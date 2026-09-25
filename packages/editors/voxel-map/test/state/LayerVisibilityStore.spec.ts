// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  LayerVisibilityStore
} from "../../src/state/LayerVisibilityStore.ts";

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

  test("copies an override to another key", () => {
    const store = new LayerVisibilityStore();
    store.override("voxel:Ground", false);

    store.copy("voxel:Ground", "voxel:Ground copy");
    store.copy("voxel:Missing", "voxel:Other");

    assert.deepStrictEqual([...store.keys], ["voxel:Ground", "voxel:Ground copy"]);
  });

  test("transfers an override to another key", () => {
    const store = new LayerVisibilityStore();
    store.override("obj:A/1", false);

    store.transfer("obj:A/1", "obj:B/1");

    assert.deepStrictEqual([...store.keys], ["obj:B/1"]);
    assert.strictEqual(store.resolve("obj:B/1", true), false);
  });

  test("retains only the keys that pass the predicate", () => {
    const store = new LayerVisibilityStore();
    store.override("voxel:Ground", false);
    store.override("object:Triggers", false);
    store.override("obj:Triggers/1", true);

    store.retain((key) => key.startsWith("voxel:"));

    assert.deepStrictEqual([...store.keys], ["voxel:Ground"]);
  });
});
