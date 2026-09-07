// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Face,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type { UVRegion } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import { editorState } from "../../../../src/app/state/index.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv
} from "./blockUvFixtures.ts";

describe("BlockUvBridge.setActiveTileset", () => {
  it("restores one grid-snapped region per block on the active tileset", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 2, row: 1, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(3, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    const ramp = {
      ...makeBlock(1, { col: 2, row: 1, tilesetId: "atlas" }),
      shapeId: "ramp"
    } satisfies ResolvedBlockDefinition;
    engine.blockRegistry.register(ramp);

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");

      const region = uv.get("block-1")!;
      // The ramp's upright quad is PosZ, which maps to "front", not "back".
      assert.deepEqual(region.facesOf().map(({ face }) => face), [
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 0, row: 0, tilesetId: "other" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register({
      ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
      defaultTexture: undefined,
      faceTextures: {
        top: { col: 2, row: 1, tilesetId: "atlas" }
      }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "free");
      assert.deepEqual(region.faces, ["top"]);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 0, y: 0, width: 16, height: 16 });

      engine.blockRegistry.register(makeBlock(1, { col: 3, row: 2, tilesetId: "atlas" }));
      editorState.world.emit("blockRegistryChanged");

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), { x: 48, y: 32, width: 16, height: 16 });
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / region-moved", () => {
  it("moves freely (no grid snapping) and updates the block's col/row from the raw position", () => {
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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

describe("BlockUvBridge / region-dragging", () => {
  it("applies a pointer-rate preview to the block so the mesh follows the drag", () => {
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.previewMove("block-1", { x: 32, y: 16, width: 16, height: 16 });

      const previewed = engine.blockRegistry.get(1)!;
      assert.equal(previewed.defaultTexture!.col, 2);
      assert.equal(previewed.defaultTexture!.row, 1);
      assert.deepEqual(dirtyReasons, ["block-defined"]);
    }
    finally {
      bridge.dispose();
    }
  });

  it("ignores a drag of a region that is not a block's", () => {
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.create({ id: "custom-region", width: 8, height: 8 });

      uv.previewMove("custom-region", { x: 5, y: 5, width: 8, height: 8 });

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });

  it("does not re-apply a drag that lands where the block already is", () => {
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      const rect = uv.get("block-1")!.rectFor("front");

      uv.previewMove("block-1", rect);

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });

  it("does not remesh again when the commit lands where the preview already put the block", () => {
    const { engine, dirtyReasons } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      const target = { x: 32, y: 16, width: 16, height: 16 };

      uv.previewMove("block-1", target);
      uv.move("block-1", target);

      assert.deepEqual(
        dirtyReasons,
        ["block-defined"],
        "the preview already wrote the block; the release is a no-op"
      );
      const updated = engine.blockRegistry.get(1)!;
      assert.equal(updated.defaultTexture!.col, 2);
      assert.equal(updated.defaultTexture!.row, 1);
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge / faceTextures round-trip", () => {
  it("freeing a block region writes all six faceTextures", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 2, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "free");
      uv.move("block-1", { x: 48, y: 32, width: 16, height: 16 }, "top");

      editorState.world.emit("blockRegistryChanged");

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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register({
      ...makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }),
      faceTextures: { [Face.PosY]: { col: 2, row: 0, tilesetId: "atlas" } }
    });

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      // Force a transition because EditorState is shared across tests.
      editorState.brush.blockId = 999;
      editorState.brush.blockId = 2;

      assert.equal(uv.selectedRegionId, "block-2");
    }
    finally {
      bridge.dispose();
      editorState.brush.blockId = 1;
    }
  });

  it("selecting a UV region selects its block", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.select("block-2");

      assert.equal(editorState.brush.blockId, 2);
    }
    finally {
      bridge.dispose();
      editorState.brush.blockId = 1;
    }
  });
});

describe("BlockUvBridge / selection at boot", () => {
  it("highlights the block already selected before the tileset loaded", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    // Boot state: block 1 is selected and emits no selectedBlockChange of
    // its own, so nothing but the rebuild can apply the highlight.
    editorState.brush.blockId = 1;

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      assert.equal(uv.selectedRegionId, "block-1");
    }
    finally {
      bridge.dispose();
      editorState.brush.blockId = 1;
    }
  });

  it("keeps the highlight across an in-place registry reconciliation", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      editorState.brush.blockId = 2;

      engine.blockRegistry.register(makeBlock(3, { col: 2, row: 0, tilesetId: "atlas" }));
      editorState.world.emit("blockRegistryChanged");

      assert.equal(uv.selectedRegionId, "block-2");
    }
    finally {
      bridge.dispose();
      editorState.brush.blockId = 1;
    }
  });
});

describe("BlockUvBridge / deleted region", () => {
  it("brings the highlight back with the region it restores", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      editorState.brush.blockId = 2;
      assert.equal(uv.selectedRegionId, "block-2");

      // A remote peer deleting the region drops the selection with it.
      uv.delete("block-2");

      assert.ok(uv.get("block-2"));
      assert.equal(uv.selectedRegionId, "block-2");
    }
    finally {
      bridge.dispose();
      editorState.brush.blockId = 1;
    }
  });
});

describe("BlockUvBridge / derived-region rebuilds", () => {
  it("does not churn unchanged regions on a registry notification", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    let created = 0;
    let deleted = 0;
    uv.on("region-created", () => created++);
    uv.on("region-deleted", () => deleted++);

    try {
      bridge.setActiveTileset("atlas", 16);
      created = 0;

      editorState.world.emit("blockRegistryChanged");

      assert.equal(created, 0);
      assert.equal(deleted, 0);
    }
    finally {
      bridge.dispose();
    }
  });

  it("runs the whole rebuild inside the local-restore scope", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));
    engine.blockRegistry.register(makeBlock(2, { col: 1, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const outsideScope: string[] = [];
    let depth = 0;
    function recordIfUnscoped(
      { region }: { region: UVRegion; }
    ): void {
      if (depth === 0) {
        outsideScope.push(region.id);
      }
    }
    uv.on("region-created", recordIfUnscoped);
    uv.on("region-deleted", recordIfUnscoped);

    const bridge = new BlockUvBridge(uv, engine, {
      runLocalRestore: (fn) => {
        depth++;
        try {
          return fn();
        }
        finally {
          depth--;
        }
      }
    });
    try {
      bridge.setActiveTileset("atlas", 16);
      bridge.setActiveTileset("atlas", 32);

      assert.deepEqual(outsideScope, []);
      assert.deepEqual(uv.get("block-2")?.rectFor("front"), {
        x: 32,
        y: 0,
        width: 32,
        height: 32
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("rebuilds unscoped when no scope is supplied", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      assert.deepEqual(uv.get("block-1")?.rectFor("front"), {
        x: 0,
        y: 0,
        width: 16,
        height: 16
      });
    }
    finally {
      bridge.dispose();
    }
  });
});

describe("BlockUvBridge — unfolding a block region", () => {
  it("claims one tile per face, rewriting the block's faceTextures", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 1, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 0, row: 0, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.setState("block-1", "unfolded");

      for (const { geometry } of uv.get("block-1")!.facesOf()) {
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
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(makeBlock(1, { col: 1, row: 1, tilesetId: "atlas" }));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
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
