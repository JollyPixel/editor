// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  EditorState,
  type LayerSelection
} from "../src/EditorState.ts";

describe("EditorState", () => {
  it("publishes one typed selection value", () => {
    const state = new EditorState();
    const selections: LayerSelection[] = [];
    const unsubscribe = state.on("selectionChange", (selection) => {
      selections.push(selection);
    });

    state.selectVoxelLayer("Ground");
    // Same name, other kind: the two must not collapse into one selection.
    state.selectObjectLayer("Ground");
    state.selectObject({ layerName: "Ground", objectId: "spawn" });
    state.setSelection(null);
    unsubscribe();
    state.selectVoxelLayer("Ignored");

    assert.deepEqual(selections, [
      { kind: "voxel-layer", name: "Ground" },
      { kind: "object-layer", name: "Ground" },
      { kind: "object", layerName: "Ground", objectId: "spawn" },
      null
    ]);
  });

  it("drops a selection that repeats the current one", () => {
    const state = new EditorState();
    let changes = 0;
    state.on("selectionChange", () => changes++);

    state.selectObject({ layerName: "Objects", objectId: "spawn" });
    state.selectObject({ layerName: "Objects", objectId: "spawn" });
    state.selectObject({ layerName: "Objects", objectId: "door" });

    assert.equal(changes, 2);
  });

  it("derives the active object layer from either object row kind", () => {
    const state = new EditorState();

    state.selectVoxelLayer("Ground");
    assert.equal(state.activeObjectLayer, null);
    assert.equal(state.selectedVoxelLayer, "Ground");
    assert.equal(state.isObjectContext, false);

    state.selectObjectLayer("Triggers");
    assert.equal(state.activeObjectLayer, "Triggers");
    assert.equal(state.selectedVoxelLayer, null);
    assert.equal(state.selectedObject, null);
    assert.equal(state.isObjectContext, true);

    state.selectObject({ layerName: "Triggers", objectId: "door" });
    assert.equal(state.activeObjectLayer, "Triggers");
    assert.deepEqual(state.selectedObject, {
      layerName: "Triggers",
      objectId: "door"
    });
  });

  it("clears the gizmo layer whenever the selection moves", () => {
    const state = new EditorState();
    state.selectVoxelLayer("Ground");
    state.setGizmoLayer("Ground");

    state.selectVoxelLayer("Decor");

    assert.equal(state.gizmoLayer, null);
  });

  it("resolves the view focus through the registered provider", () => {
    const state = new EditorState();

    assert.deepEqual(state.viewFocus, {
      x: 0,
      y: 0,
      z: 0
    });

    state.viewFocusProvider = () => {
      return {
        x: 12,
        y: 3,
        z: -8
      };
    };
    assert.deepEqual(state.viewFocus, {
      x: 12,
      y: 3,
      z: -8
    });

    state.viewFocusProvider = null;
    assert.deepEqual(state.viewFocus, {
      x: 0,
      y: 0,
      z: 0
    });
  });
});
