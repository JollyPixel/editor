// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Face,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv
} from "./blockUvFixtures.ts";

describe("BlockUvBridge.setActiveTileset", () => {
  it("restores one grid-snapped region per block on the active tileset", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 2, row: 1, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(3, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });
      assert.deepEqual(uv.get("block-2")?.rectFor("front"), { x: 32, y: 16, width: 16, height: 16 });
      assert.equal(uv.get("block-3"), undefined);
    }
    finally {
      bridge.dispose();
    }
  });

  it("restores ramp sides as triangular geometry", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    const ramp = {
      ...makeBlock(1, { col: 2, row: 1, tilesetId: "atlas" }),
      shapeId: "ramp"
    } satisfies ResolvedBlockDefinition;
    engine.blockRegistry.register(ramp);

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
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

  it("rebuilds the region set when the active tileset switches", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.ok(uv.get("block-1"));
      assert.equal(uv.get("block-2"), undefined);

      bridge.setActiveTileset("other", 32);
      assert.equal(uv.get("block-1"), undefined);
      assert.ok(uv.get("block-2"));
    }
    finally {
      bridge.dispose();
    }
  });

  it("includes a face-only block with no default texture", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register({
      ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
      defaultTexture: undefined,
      faceTextures: {
        top: { col: 2, row: 1, tilesetId: "atlas" }
      }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);

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

describe("BlockUvBridge / blockRegistryChanged", () => {
  it("reflects an externally-updated block's new col/row on the next rebuild", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });

      engine.blockRegistry.register(makeBlock(1, { col: 3, row: 2, tilesetId: "atlas" }));
      bridgeOptions.mapDocument.emit("blockRegistryChanged");

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 48, y: 32, width: 16, height: 16 });
    }
    finally {
      bridge.dispose();
    }
  });

  it("renames the region when the block definition is renamed", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.equal(uv.get("block-1")?.name, "Block1");

      engine.blockRegistry.register({
        ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
        name: "Grass"
      });
      bridgeOptions.mapDocument.emit("blockRegistryChanged");

      assert.equal(uv.get("block-1")?.name, "Grass");
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / region-moved", () => {
  it("moves freely (no grid snapping) and updates the block's col/row from the raw position", () => {
    const { engine, dirtyReasons, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.move("block-1", { x: 30, y: 50, width: 16, height: 16 });

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 30, y: 50, width: 16, height: 16 });
      const updated = engine.blockRegistry.get(1)!;
      assert.equal(updated.defaultTexture!.col, 1.875);
      assert.equal(updated.defaultTexture!.row, 3.125);
      assert.deepEqual(dirtyReasons, ["block-defined"]);
    }
    finally {
      bridge.dispose();
    }
  });

  it("ignores manually-created free-form UV regions (non block-<id> ids)", () => {
    const { engine, dirtyReasons, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 2, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");

      const updated = engine.blockRegistry.get(1)!;
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");

      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      const updated = engine.blockRegistry.get(1)!;
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      uv.setState("block-1", "stacked", "top");

      const updated = engine.blockRegistry.get(1)!;
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      bridgeOptions.mapDocument.emit("blockRegistryChanged");

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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register({
      ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
      faceTextures: { [Face.PosY]: { col: 2, row: 0, tilesetId: "atlas" } }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);

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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 1, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "unfolded");

      const block = engine.blockRegistry.get(1)!;
      assert.deepEqual(block.faceTextures, {
        front: { col: 1, row: 1, tilesetId: "atlas" },
        back: { col: 2, row: 1, tilesetId: "atlas" },
        left: { col: 1, row: 2, tilesetId: "atlas" },
        right: { col: 2, row: 2, tilesetId: "atlas" },
        top: { col: 1, row: 3, tilesetId: "atlas" },
        bottom: { col: 2, row: 3, tilesetId: "atlas" }
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("keeps the net tile-aligned, so no face lands on a half tile", () => {
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
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
    const { engine, bridgeOptions } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 1, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine, bridgeOptions);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "unfolded");
      const unfolded = engine.blockRegistry.get(1)!.faceTextures;

      uv.setState("block-1", "free");

      assert.deepEqual(engine.blockRegistry.get(1)!.faceTextures, unfolded);
    }
    finally {
      bridge.dispose();
    }
  });
});
