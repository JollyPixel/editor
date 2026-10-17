// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot,
  makeBlock
} from "./blockUvFixtures.ts";

describe("BlockUvBridge / shape footprint", () => {
  function shapedBlock(
    shapeId: string
  ): ResolvedBlockDefinition {
    return {
      ...makeBlock(1, { col: 2, row: 1, blocksetId: "atlas" }),
      shapeId
    };
  }

  it("gives an unfolded ramp slope its true length", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("ramp"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "unfolded");

      const region = uv.get("block-1")!;
      assert.equal(region.state, "unfolded");
      assert.deepEqual(region.slotGeometry("top"), {
        x: 32,
        y: 16,
        width: 16,
        height: 23
      });

      const block = view.document.blocks.get(1)!;
      assert.deepEqual(
        block.faceTextures.top,
        { col: 2, row: 1, blocksetId: "atlas" }
      );
    }
    finally {
      bridge.dispose();
    }
  });
});
