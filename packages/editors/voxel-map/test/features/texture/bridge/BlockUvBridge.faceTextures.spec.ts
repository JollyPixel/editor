// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Face } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";

describe("BlockUvBridge / faceTextures round-trip", () => {
  it("freeing a block region writes all six faceTextures", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 2, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      const updated = view.document.blocks.get(1)!;
      assert.equal(
        Object.keys(updated.faceTextures).length,
        6,
        "a populated faceTextures is what marks the block free"
      );
      for (const tileRef of Object.values(updated.faceTextures)) {
        assert.deepEqual(
          { col: tileRef.col, row: tileRef.row },
          { col: 1, row: 2 },
          "freeing must not move any face"
        );
      }
    }
    finally {
      bridge.dispose();
    }
  });

  it("moving one face updates only that face's tile", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      const updated = view.document.blocks.get(1)!;
      assert.deepEqual(
        { col: updated.faceTextures.top!.col, row: updated.faceTextures.top!.row },
        { col: 3, row: 2 }
      );
      assert.deepEqual(
        { col: updated.faceTextures.front!.col, row: updated.faceTextures.front!.row },
        { col: 0, row: 0 },
        "front must stay where it was"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("stacking clears faceTextures and writes defaultTexture", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      uv.applyState("block-1", "stacked", "top");

      const updated = view.document.blocks.get(1)!;
      assert.deepEqual(updated.faceTextures, {});
      assert.deepEqual(
        { col: updated.defaultTexture!.col, row: updated.defaultTexture!.row },
        { col: 3, row: 2 },
        "the surviving face becomes the block's single texture"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("an free block survives a rebuild triggered from outside", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      bridgeOptions.editorMap.emit("blockRegistryChanged", "redefined");

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(
        region.slotRect("top"),
        { x: 48, y: 32, width: 16, height: 16 }
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("a block authored with partial faceTextures rebuilds as free, filling gaps from defaultTexture", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register({
      ...makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }),
      faceTextures: { [Face.PosY]: { col: 2, row: 0, blocksetId: "atlas" } }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(region.slotRect("top"), { x: 32, y: 0, width: 16, height: 16 });
      assert.deepEqual(
        region.slotRect("front"),
        { x: 0, y: 0, width: 16, height: 16 },
        "faces absent from faceTextures fall back to defaultTexture"
      );
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / region-deleted", () => {
  it("self-heals a block region deleted via the generic UV toolbar", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.ok(uv.get("block-1"));

      uv.delete("block-1");

      assert.ok(uv.get("block-1"));
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge — unfolding a block region", () => {
  it("claims one tile per face, rewriting the block's faceTextures", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 1, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "unfolded");

      const block = view.document.blocks.get(1)!;
      assert.deepEqual(block.faceTextures, {
        front: { col: 1, row: 1, blocksetId: "atlas" },
        back: { col: 2, row: 1, blocksetId: "atlas" },
        left: { col: 1, row: 2, blocksetId: "atlas" },
        right: { col: 2, row: 2, blocksetId: "atlas" },
        top: { col: 1, row: 3, blocksetId: "atlas" },
        bottom: { col: 2, row: 3, blocksetId: "atlas" }
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("keeps the net tile-aligned, so no face lands on a half tile", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "unfolded");

      for (const { geometry } of uv.get("block-1")!.listSlots()) {
        const rect = "shape" in geometry ? geometry.rect : geometry;
        assert.equal(rect.x % 16, 0, "x is on a tile boundary");
        assert.equal(rect.y % 16, 0, "y is on a tile boundary");
      }
    }
    finally {
      bridge.dispose();
    }
  });

  it("freeing an unfolded block keeps the tiles the net claimed", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 1, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "unfolded");
      const unfolded = view.document.blocks.get(1)!.faceTextures;

      uv.applyState("block-1", "free");

      assert.deepEqual(view.document.blocks.get(1)!.faceTextures, unfolded);
    }
    finally {
      bridge.dispose();
    }
  });
});
