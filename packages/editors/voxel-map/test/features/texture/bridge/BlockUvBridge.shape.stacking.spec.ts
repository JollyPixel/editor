// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { BlockShapeRegistry, type ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

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

  it("keeps every face's size across a stack round-trip", () => {
    for (const { id: shapeId } of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.activateBlockset(blocksetSlot("atlas"), 16);
        uv.applyState("block-1", "free");
        const before = uv.get("block-1")!.listSlots();

        uv.applyState("block-1", "stacked");
        uv.applyState("block-1", "free");

        assert.deepEqual(
          uv.get("block-1")!.listSlots(),
          before,
          `${shapeId} lost face geometry`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("keeps every face's size across a serialized stack round-trip", () => {
    for (const { id: shapeId } of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.activateBlockset(blocksetSlot("atlas"), 16);
        uv.applyState("block-1", "free");
        const before = uv.get("block-1")!.listSlots();

        uv.applyState("block-1", "stacked");
        uv.restore(uv.get("block-1")!.toJSON());
        uv.applyState("block-1", "free");

        assert.deepEqual(
          uv.get("block-1")!.listSlots(),
          before,
          `${shapeId} lost face geometry through serialization`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("stacks a pole onto its largest face, not its smallest", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("pole"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      uv.applyState("block-1", "stacked");

      const region = uv.get("block-1")!;
      assert.equal(region.stackedFace, "left");
      assert.deepEqual(region.slotRect("front"), {
        x: 32,
        y: 22,
        width: 16,
        height: 4
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("stacks onto the tile the block already used", () => {
    for (const shapeId of ["cube", "pole", "slabBottom"]) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.activateBlockset(blocksetSlot("atlas"), 16);

        uv.applyState("block-1", "stacked");

        const { defaultTexture } = view.document.blocks.get(1)!;
        assert.deepEqual(
          { col: defaultTexture!.col, row: defaultTexture!.row },
          { col: 2, row: 1 },
          `${shapeId} moved off its tile when stacked`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("keeps a stacked ramp slope on one square tile", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("ramp"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "stacked");
      assert.deepEqual(region.slotRect("top"), {
        x: 32,
        y: 16,
        width: 16,
        height: 16
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("gives a free ramp slope its true length", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("ramp"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.slotRect("top"), {
        x: 32,
        y: 16,
        width: 16,
        height: 23
      });
      assert.deepEqual(region.slotRect("front"), {
        x: 32,
        y: 16,
        width: 16,
        height: 16
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
