// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  SelectionStore,
  type LayerSelection
} from "../../src/state/SelectionStore.ts";

function voxel(
  name: string
): LayerSelection {
  return {
    kind: "voxel-layer",
    name
  };
}

function objectLayer(
  name: string
): LayerSelection {
  return {
    kind: "object-layer",
    name
  };
}

function object(
  layerName: string,
  objectId: string
): LayerSelection {
  return {
    kind: "object",
    layerName,
    objectId
  };
}

function storeOn(
  entries: readonly LayerSelection[],
  selected: LayerSelection
): SelectionStore {
  const store = new SelectionStore();
  store.reconcile(entries);
  store.current = selected;

  return store;
}

describe("SelectionStore.reconcile", () => {
  test("selects the first voxel layer when nothing is selected", () => {
    const store = new SelectionStore();
    store.reconcile([objectLayer("Props"), voxel("Ground"), voxel("Roof")]);

    assert.deepEqual(store.current, voxel("Ground"));
  });

  test("falls back to the first object layer when no voxel layer exists", () => {
    const store = new SelectionStore();
    store.reconcile([objectLayer("Props"), object("Props", "a")]);

    assert.deepEqual(store.current, objectLayer("Props"));
  });

  test("keeps a selection that still exists", () => {
    const store = storeOn([voxel("Ground"), voxel("Roof")], voxel("Roof"));
    let changes = 0;
    store.subscribe("change", () => changes++);

    store.reconcile([voxel("Roof"), voxel("Ground"), voxel("Walls")]);

    assert.deepEqual(store.current, voxel("Roof"));
    assert.strictEqual(changes, 0);
  });

  test("moves to the layer below a removed voxel layer", () => {
    const store = storeOn(
      [voxel("A"), voxel("B"), voxel("C")],
      voxel("B")
    );

    store.reconcile([voxel("A"), voxel("C")]);

    assert.deepEqual(store.current, voxel("C"));
  });

  test("moves to the layer above when the last voxel layer is removed", () => {
    const store = storeOn(
      [voxel("A"), voxel("B"), voxel("C")],
      voxel("C")
    );

    store.reconcile([voxel("A"), voxel("B")]);

    assert.deepEqual(store.current, voxel("B"));
  });

  test("follows a renamed voxel layer", () => {
    const store = storeOn(
      [voxel("A"), voxel("B"), voxel("C")],
      voxel("B")
    );

    store.reconcile([voxel("A"), voxel("Renamed"), voxel("C")]);

    assert.deepEqual(store.current, voxel("Renamed"));
  });

  test("selects the parent layer of a removed object", () => {
    const store = storeOn(
      [voxel("Ground"), objectLayer("Props"), object("Props", "a")],
      object("Props", "a")
    );

    store.reconcile([voxel("Ground"), objectLayer("Props")]);

    assert.deepEqual(store.current, objectLayer("Props"));
  });

  test("moves to a sibling object layer when an object layer is removed", () => {
    const store = storeOn(
      [voxel("Ground"), objectLayer("Props"), objectLayer("Spawns")],
      objectLayer("Props")
    );

    store.reconcile([voxel("Ground"), objectLayer("Spawns")]);

    assert.deepEqual(store.current, objectLayer("Spawns"));
  });

  test("falls back to a voxel layer when the last object layer is removed", () => {
    const store = storeOn(
      [voxel("Ground"), objectLayer("Props"), object("Props", "a")],
      object("Props", "a")
    );

    store.reconcile([voxel("Ground")]);

    assert.deepEqual(store.current, voxel("Ground"));
  });

  test("clears the selection only when the world has no layer left", () => {
    const store = storeOn([voxel("Ground")], voxel("Ground"));
    const changes: Array<LayerSelection | null> = [];
    store.subscribe("change", (selection) => changes.push(selection));

    store.reconcile([]);

    assert.strictEqual(store.current, null);
    assert.deepEqual(changes, [null]);
  });

  test("follows a renamed object layer", () => {
    const store = storeOn(
      [objectLayer("Props"), objectLayer("Spawns")],
      objectLayer("Props")
    );

    store.reconcile([objectLayer("Items"), objectLayer("Spawns")]);

    assert.deepEqual(store.current, objectLayer("Items"));
  });

  test("resets the gizmo layer when the selection moves", () => {
    const store = storeOn([voxel("A"), voxel("B")], voxel("A"));
    store.gizmoLayer = "A";

    store.reconcile([voxel("B")]);

    assert.strictEqual(store.gizmoLayer, null);
  });
});

describe("SelectionStore.lastVoxelLayer", () => {
  test("remembers the voxel layer selected before an object layer", () => {
    const store = storeOn(
      [voxel("Ground"), voxel("Roof"), objectLayer("Props")],
      voxel("Roof")
    );

    store.selectObjectLayer("Props");

    assert.strictEqual(store.voxelLayer, null);
    assert.strictEqual(store.lastVoxelLayer, "Roof");
  });

  test("falls back to the first voxel layer when the remembered one is gone", () => {
    const store = storeOn(
      [voxel("Ground"), voxel("Roof"), objectLayer("Props")],
      voxel("Roof")
    );
    store.selectObjectLayer("Props");

    store.reconcile([voxel("Ground"), objectLayer("Props")]);

    assert.strictEqual(store.lastVoxelLayer, "Ground");
  });

  test("is null when the world has no voxel layer", () => {
    const store = storeOn([objectLayer("Props")], objectLayer("Props"));

    assert.strictEqual(store.lastVoxelLayer, null);
  });
});
