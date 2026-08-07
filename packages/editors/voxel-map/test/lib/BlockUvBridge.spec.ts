// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  Face,
  type VoxelRenderer,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../src/lib/BlockUvBridge.ts";
import { editorState } from "../../src/EditorState.ts";

interface BlockTexturePlacement {
  col: number;
  row: number;
  tilesetId: string;
}

function makeBlock(
  id: number,
  placement: BlockTexturePlacement
): BlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: {},
    defaultTexture: { ...placement }
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

function makeUv(): UVMap {
  return new UVMap({
    getCanvasSize: () => {
      return { x: 256, y: 256 };
    }
  });
}

describe("BlockUvBridge.setActiveTileset", () => {
  it("restores one grid-snapped region per block on the active tileset", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    vr.engine.blockRegistry.register(makeBlock(2, { col: 2, row: 1, tilesetId: "atlas" }));
    vr.engine.blockRegistry.register(makeBlock(3, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
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

  it("rebuilds the region set when the active tileset switches", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    vr.engine.blockRegistry.register(makeBlock(2, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
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
});

describe("BlockUvBridge / blockRegistryChanged", () => {
  it("reflects an externally-updated block's new col/row on the next rebuild", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });

      vr.engine.blockRegistry.register(makeBlock(1, { col: 3, row: 2, tilesetId: "atlas" }));
      editorState.dispatchBlockRegistryChanged();

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 48, y: 32, width: 16, height: 16 });
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / region-moved", () => {
  it("moves freely (no grid snapping) and updates the block's col/row from the raw position", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.move("block-1", { x: 30, y: 50, width: 16, height: 16 });

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 30, y: 50, width: 16, height: 16 });
      const updated = vr.engine.blockRegistry.get(1)!;
      assert.equal(updated.defaultTexture!.col, 1.875);
      assert.equal(updated.defaultTexture!.row, 3.125);
      assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
    }
    finally {
      bridge.dispose();
    }
  });

  it("ignores manually-created free-form UV regions (non block-<id> ids)", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      const region = uv.create({ id: "custom-region", width: 8, height: 8 });

      uv.move("custom-region", { x: 5, y: 5, width: 8, height: 8 });

      assert.deepEqual(uv.get("custom-region")?.rectFor("front"), { x: 5, y: 5, width: 8, height: 8 });
      assert.deepEqual(dirtyReasons, []);
      assert.equal(region.id, "custom-region");
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / faceTextures round-trip", () => {
  it("uncollapsing a block region writes all six faceTextures", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 1, row: 2, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const updated = vr.engine.blockRegistry.get(1)!;
      assert.equal(
        Object.keys(updated.faceTextures).length,
        6,
        "a populated faceTextures is what marks the block uncollapsed"
      );
      for (const tileRef of Object.values(updated.faceTextures)) {
        assert.deepEqual(
          { col: tileRef.col, row: tileRef.row },
          { col: 1, row: 2 },
          "uncollapsing must not move any face"
        );
      }
    }
    finally {
      bridge.dispose();
    }
  });

  it("moving one face updates only that face's tile", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      const updated = vr.engine.blockRegistry.get(1)!;
      assert.deepEqual(
        { col: updated.faceTextures[Face.PosY]!.col, row: updated.faceTextures[Face.PosY]!.row },
        { col: 3, row: 2 }
      );
      assert.deepEqual(
        { col: updated.faceTextures[Face.PosZ]!.col, row: updated.faceTextures[Face.PosZ]!.row },
        { col: 0, row: 0 },
        "front must stay where it was"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("collapsing clears faceTextures and writes defaultTexture", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      uv.collapse("block-1", "top");

      const updated = vr.engine.blockRegistry.get(1)!;
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

  it("an uncollapsed block survives a rebuild triggered from outside", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      editorState.dispatchBlockRegistryChanged();

      const region = uv.get("block-1")!;
      assert.equal(region.state, "uncollapsed");
      assert.deepEqual(
        region.rectFor("top"),
        { x: 48, y: 32, width: 16, height: 16 }
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("a block authored with partial faceTextures rebuilds as uncollapsed, filling gaps from defaultTexture", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register({
      ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
      faceTextures: { [Face.PosY]: { col: 2, row: 0, tilesetId: "atlas" } }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "uncollapsed");
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
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
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

describe("BlockUvBridge / selection cross-highlight", () => {
  it("selecting a block selects its UV region", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    vr.engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);

      // setSelectedBlock() no-ops on an unchanged id, and editorState is a
      // shared singleton — force a real transition regardless of whatever
      // other tests left it at.
      editorState.setSelectedBlock(999);
      editorState.setSelectedBlock(2);

      assert.equal(uv.selectedRegionId, "block-2");
    }
    finally {
      bridge.dispose();
      editorState.setSelectedBlock(1);
    }
  });

  it("selecting a UV region selects its block", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    vr.engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, vr);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.select("block-2");

      assert.equal(editorState.selectedBlockId, 2);
    }
    finally {
      bridge.dispose();
      editorState.setSelectedBlock(1);
    }
  });
});
