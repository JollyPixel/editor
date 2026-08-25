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

    state.setSelectedLayer("Ground", "voxel");
    state.setSelectedLayer("Ground", "object");
    state.setSelectedLayer(null);
    unsubscribe();
    state.setSelectedLayer("Ignored", "voxel");

    assert.deepEqual(selections, [
      { name: "Ground", type: "voxel" },
      { name: "Ground", type: "object" },
      null
    ]);
  });
});
