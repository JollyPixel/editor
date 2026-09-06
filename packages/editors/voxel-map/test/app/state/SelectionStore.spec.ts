// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  SelectionStore,
  type LayerSelection
} from "../../../src/app/state/index.ts";

describe("SelectionStore", () => {
  it("publishes one typed selection value", () => {
    const selection = new SelectionStore();
    const values: LayerSelection[] = [];
    const unsubscribe = selection.watch("change", (value) => {
      values.push(value);
    });

    selection.selectVoxelLayer("Ground");
    // Same name, other kind: the two must not collapse into one selection.
    selection.selectObjectLayer("Ground");
    selection.selectObject({ layerName: "Ground", objectId: "spawn" });
    selection.clear();
    unsubscribe();
    selection.selectVoxelLayer("Ignored");

    assert.deepEqual(values, [
      { kind: "voxel-layer", name: "Ground" },
      { kind: "object-layer", name: "Ground" },
      { kind: "object", layerName: "Ground", objectId: "spawn" },
      null
    ]);
  });

  it("drops a selection that repeats the current one", () => {
    const selection = new SelectionStore();
    let changes = 0;
    selection.watch("change", () => changes++);

    selection.selectObject({ layerName: "Objects", objectId: "spawn" });
    selection.selectObject({ layerName: "Objects", objectId: "spawn" });
    selection.selectObject({ layerName: "Objects", objectId: "door" });

    assert.equal(changes, 2);
  });

  it("derives the active object layer from either object row kind", () => {
    const selection = new SelectionStore();

    selection.selectVoxelLayer("Ground");
    assert.equal(selection.objectLayer, null);
    assert.equal(selection.voxelLayer, "Ground");
    assert.equal(selection.isObjectContext, false);

    selection.selectObjectLayer("Triggers");
    assert.equal(selection.objectLayer, "Triggers");
    assert.equal(selection.voxelLayer, null);
    assert.equal(selection.object, null);
    assert.equal(selection.isObjectContext, true);

    selection.selectObject({ layerName: "Triggers", objectId: "door" });
    assert.equal(selection.objectLayer, "Triggers");
    assert.deepEqual(selection.object, {
      layerName: "Triggers",
      objectId: "door"
    });
  });

  it("clears the gizmo layer whenever the selection moves", () => {
    const selection = new SelectionStore();
    const cleared: (string | null)[] = [];
    selection.watch("gizmoLayerChange", (name) => cleared.push(name));

    selection.selectVoxelLayer("Ground");
    selection.gizmoLayer = "Ground";

    selection.selectVoxelLayer("Decor");

    assert.equal(selection.gizmoLayer, null);
    assert.deepEqual(cleared, ["Ground", null]);
  });

  it("publishes a gizmo drag only when the flag flips", () => {
    const selection = new SelectionStore();
    const drags: boolean[] = [];
    selection.watch("gizmoDraggingChange", (value) => drags.push(value));

    selection.gizmoDragging = true;
    selection.gizmoDragging = true;
    selection.gizmoDragging = false;

    assert.deepEqual(drags, [true, false]);
  });
});
