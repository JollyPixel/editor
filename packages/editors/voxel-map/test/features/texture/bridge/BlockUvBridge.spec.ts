// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { composeBlockId, type ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";

describe("BlockUvBridge.activateBlockset", () => {
  it("restores one grid-snapped region per block on the active blockset", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(2, { col: 2, row: 1, blocksetId: "atlas" }));
    view.document.blocks.register(makeBlock(3, { col: 0, row: 0, blocksetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      assert.deepEqual(uv.get("block-1")?.slotRect("front"), { x: 0, y: 0, width: 16, height: 16 });
      assert.deepEqual(uv.get("block-2")?.slotRect("front"), { x: 32, y: 16, width: 16, height: 16 });
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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.listSlots().map(({ slot }) => slot), [
        "front", "left", "right", "top", "bottom"
      ]);
      assert.deepEqual(region.slotGeometry("left"), {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 32, y: 16, width: 16, height: 16 }
      });
      assert.deepEqual(region.slotGeometry("right"), {
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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.ok(uv.get("block-1"));
      assert.equal(uv.get("block-2"), undefined);

      bridge.activateBlockset(blocksetSlot("other"), 32);
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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(region.slots, ["top"]);
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
      bridge.activateBlockset(blocksetSlot("atlas", 2), 16);

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
      bridge.activateBlockset(blocksetSlot("atlas", 2), 16);

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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.deepEqual(uv.get("block-1")?.slotRect("front"), { x: 0, y: 0, width: 16, height: 16 });

      view.document.blocks.register(makeBlock(1, { col: 3, row: 2, blocksetId: "atlas" }));
      bridgeOptions.editorMap.emit("blockRegistryChanged", "redefined");

      assert.deepEqual(uv.get("block-1")?.slotRect("front"), { x: 48, y: 32, width: 16, height: 16 });
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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")?.name, "Block1");

      view.document.blocks.register({
        ...makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" }),
        name: "Grass"
      });
      bridgeOptions.editorMap.emit("blockRegistryChanged", "redefined");

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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);

      uv.move("block-1", { x: 30, y: 50, width: 16, height: 16 });

      assert.deepEqual(uv.get("block-1")?.slotRect("front"), { x: 30, y: 50, width: 16, height: 16 });
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
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.create({ id: "custom-region", width: 8, height: 8 });
      uv.move("custom-region", { x: 5, y: 5, width: 8, height: 8 });

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });
});
