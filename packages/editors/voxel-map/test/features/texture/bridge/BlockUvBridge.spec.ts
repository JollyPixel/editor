// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  Face,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";

describe("BlockUvBridge.setActiveBlockset", () => {
  it("restores one grid-snapped region per block on the active blockset", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(2, { col: 2, row: 1, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(3, { col: 0, row: 0, blocksetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });
      assert.deepEqual(uv.get("block-2")?.rectFor("front"), { x: 32, y: 16, width: 16, height: 16 });
      assert.equal(uv.get("block-3"), undefined);
    }
    finally {
      bridge.dispose();
    }
  });

  it("restores ramp sides as triangular geometry", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    const ramp = {
      ...makeBlock(1, { col: 2, row: 1, blocksetId: "atlas" }),
      shapeId: "ramp"
    } satisfies ResolvedBlockDefinition;
    view.document.blocks.register(ramp);

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.slotsOf().map(({ slot }) => slot), [
        "front", "left", "right", "top", "bottom"
      ]);
      assert.deepEqual(region.geometryFor("left"), {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 32, y: 16, width: 16, height: 16 }
      });
      assert.deepEqual(region.geometryFor("right"), {
        shape: "triangle",
        corner: "bottom-left",
        rect: { x: 32, y: 16, width: 16, height: 16 }
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("rebuilds the region set when the active blockset switches", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(2, { col: 0, row: 0, blocksetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      assert.ok(uv.get("block-1"));
      assert.equal(uv.get("block-2"), undefined);

      bridge.setActiveBlockset(blocksetSlot("other"), 32);
      assert.equal(uv.get("block-1"), undefined);
      assert.ok(uv.get("block-2"));
    }
    finally {
      bridge.dispose();
    }
  });

  it("includes a face-only block with no default texture", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register({
      ...makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }),
      defaultTexture: undefined,
      faceTextures: {
        top: { col: 2, row: 1, blocksetId: "atlas" }
      }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(region.slots, ["top"]);
      assert.deepEqual(region.rectFor("top"), {
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
});

describe("BlockUvBridge / blockset slot", () => {
  it("names regions after the local block id and writes back to the slot's block", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    const blockId = composeBlockId(2, 1);
    view.document.blocks.register(makeBlock(blockId, { col: 0, row: 0, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(1, { col: 1, row: 0, blocksetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas", 2), 16);

      assert.deepEqual([...uv.regions].map((region) => region.id), ["block-1"]);
      uv.move("block-1", { x: 32, y: 16, width: 16, height: 16 });

      assert.deepEqual(view.document.blocks.get(blockId)?.defaultTexture, {
        blocksetId: "atlas",
        col: 2,
        row: 1
      });
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 1);
    }
    finally {
      bridge.dispose();
    }
  });

  it("selects the region of a block from the active slot only", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    const blockId = composeBlockId(2, 1);
    view.document.blocks.register(makeBlock(blockId, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas", 2), 16);

      bridgeOptions.block.id = blockId;
      assert.equal(uv.selectedRegionId, "block-1");

      bridgeOptions.block.id = 1;
      assert.equal(uv.selectedRegionId, null);

      uv.select("block-1");
      assert.equal(bridgeOptions.block.id, blockId);
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / blockRegistryChanged", () => {
  it("reflects an externally-updated block's new col/row on the next rebuild", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });

      view.document.blocks.register(makeBlock(1, { col: 3, row: 2, blocksetId: "atlas" }));
      bridgeOptions.mapDocument.emit("blockRegistryChanged", "redefined");

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 48, y: 32, width: 16, height: 16 });
    }
    finally {
      bridge.dispose();
    }
  });

  it("renames the region when the block definition is renamed", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")?.name, "Block1");

      view.document.blocks.register({
        ...makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }),
        name: "Grass"
      });
      bridgeOptions.mapDocument.emit("blockRegistryChanged", "redefined");

      assert.equal(uv.get("block-1")?.name, "Grass");
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / region-moved", () => {
  it("moves freely (no grid snapping) and updates the block's col/row from the raw position", () => {
    const { view, dirtyReasons, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      uv.move("block-1", { x: 30, y: 50, width: 16, height: 16 });

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 30, y: 50, width: 16, height: 16 });
      const updated = view.document.blocks.get(1)!;
      assert.equal(updated.defaultTexture!.col, 1.875);
      assert.equal(updated.defaultTexture!.row, 3.125);
      assert.deepEqual(dirtyReasons, ["block-defined"]);
    }
    finally {
      bridge.dispose();
    }
  });

  it("ignores manually-created free-form UV regions (non block-<id> ids)", () => {
    const { view, dirtyReasons, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.create({ id: "custom-region", width: 8, height: 8 });
      uv.move("custom-region", { x: 5, y: 5, width: 8, height: 8 });

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / faceTextures round-trip", () => {
  it("freeing a block region writes all six faceTextures", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 2, blocksetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      uv.setState("block-1", "stacked", "top");

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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      bridgeOptions.mapDocument.emit("blockRegistryChanged", "redefined");

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(
        region.rectFor("top"),
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(region.rectFor("top"), { x: 32, y: 0, width: 16, height: 16 });
      assert.deepEqual(
        region.rectFor("front"),
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "unfolded");

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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "unfolded");

      for (const { geometry } of uv.get("block-1")!.slotsOf()) {
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "unfolded");
      const unfolded = view.document.blocks.get(1)!.faceTextures;

      uv.setState("block-1", "free");

      assert.deepEqual(view.document.blocks.get(1)!.faceTextures, unfolded);
    }
    finally {
      bridge.dispose();
    }
  });
});
