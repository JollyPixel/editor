// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  type VoxelRenderer,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { applyBlockUpdate } from "../../src/lib/applyBlockUpdate.ts";
import { editorState } from "../../src/EditorState.ts";

function makeBlock(): BlockDefinition {
  return {
    id: 1,
    name: "Stone",
    shapeId: "cube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { col: 0, row: 0, tilesetId: "default" }
  };
}

function makeFakeVoxelRenderer(): { vr: VoxelRenderer; dirtyReasons: string[]; } {
  const dirtyReasons: string[] = [];
  const fake = {
    engine: {
      blockRegistry: new BlockRegistry(),
      markAllChunksDirty: (reason: string) => {
        dirtyReasons.push(reason);
      }
    }
  };

  return { vr: fake as unknown as VoxelRenderer, dirtyReasons };
}

describe("applyBlockUpdate", () => {
  it("registers the updated block, marks chunks dirty, and dispatches blockRegistryChanged", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    const block = makeBlock();
    vr.engine.blockRegistry.register(block);

    let dispatched = false;
    function listener() {
      dispatched = true;
    }
    editorState.addEventListener("blockRegistryChanged", listener);

    try {
      const updated = { ...block, name: "Granite" };
      applyBlockUpdate(vr, updated);

      assert.equal(vr.engine.blockRegistry.get(1)?.name, "Granite");
      assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
      assert.equal(dispatched, true);
    }
    finally {
      editorState.removeEventListener("blockRegistryChanged", listener);
    }
  });
});
