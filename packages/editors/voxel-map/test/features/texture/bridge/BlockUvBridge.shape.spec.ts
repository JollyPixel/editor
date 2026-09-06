// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv
} from "./blockUvFixtures.ts";

describe("BlockUvBridge / shape footprint", () => {
  function shapedBlock(
    shapeId: string
  ): ResolvedBlockDefinition {
    return {
      ...makeBlock(1, { col: 2, row: 1, tilesetId: "atlas" }),
      shapeId
    };
  }

  it("sizes a pole region to the width of the pole", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("pole"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.rectFor("top"), {
        x: 32 + 6,
        y: 16,
        width: 4,
        height: 16
      });
      assert.deepEqual(region.rectFor("front"), {
        x: 32 + 6,
        y: 16 + 6,
        width: 4,
        height: 4
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("puts a slab side on the half of the tile its geometry covers", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("slabBottom"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.rectFor("front"), {
        x: 32,
        y: 16 + 8,
        width: 16,
        height: 8
      });
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

  it("keeps a cube region on the whole tile", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      assert.deepEqual(uv.get("block-1")!.rectFor("front"), {
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

  it("round-trips every shape's faces back to the tile they came from", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      const { engine } = makeFakeVoxelEngine();
      engine.blockRegistry.register(shapedBlock(shape.id));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, engine);
      try {
        bridge.setActiveTileset("atlas", 16);
        const region = uv.get("block-1");
        if (!region || region.state !== "uncollapsed") {
          continue;
        }

        for (const { face } of region.facesOf()) {
          if (face === null) {
            continue;
          }
          uv.move("block-1", region.rectFor(face), face);
        }

        const updated = engine.blockRegistry.get(1)!;
        for (const tileRef of Object.values(updated.faceTextures)) {
          assert.deepEqual(
            { col: tileRef.col, row: tileRef.row },
            { col: 2, row: 1 },
            `${shape.id} does not land back on its own tile`
          );
        }
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("resizes the region when the block changes shape", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.equal(uv.get("block-1")!.rectFor("front").width, 16);

      engine.defineBlock(shapedBlock("pole"));
      uv.uncollapse("block-1");

      assert.deepEqual(uv.get("block-1")!.rectFor("front"), {
        x: 32 + 6,
        y: 16 + 6,
        width: 4,
        height: 4
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("keeps a region collapsed when the block changes to a non-box shape", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);
      assert.equal(uv.get("block-1")!.state, "collapsed");

      engine.defineBlock(shapedBlock("stair"));

      const region = uv.get("block-1")!;
      assert.equal(
        region.state,
        "collapsed",
        "a shape change alone must not split the block into per-face textures"
      );
      assert.deepEqual(region.rectFor("front"), {
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

  it("keeps every face's size across a collapse round-trip", () => {
    for (const shapeId of ["pole", "poleY", "slabBottom", "slabTop", "stair"]) {
      const { engine } = makeFakeVoxelEngine();
      engine.blockRegistry.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, engine);
      try {
        bridge.setActiveTileset("atlas", 16);
        uv.uncollapse("block-1");
        const before = uv.get("block-1")!.facesOf();

        uv.collapse("block-1");
        uv.uncollapse("block-1");

        assert.deepEqual(
          uv.get("block-1")!.facesOf(),
          before,
          `${shapeId} lost face geometry`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("keeps every face's size across a serialized collapse round-trip", () => {
    for (const shapeId of ["pole", "poleY", "slabBottom", "slabTop", "stair"]) {
      const { engine } = makeFakeVoxelEngine();
      engine.blockRegistry.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, engine);
      try {
        bridge.setActiveTileset("atlas", 16);
        uv.uncollapse("block-1");
        const before = uv.get("block-1")!.facesOf();

        uv.collapse("block-1");
        uv.restore(uv.get("block-1")!.toJSON());
        uv.uncollapse("block-1");

        assert.deepEqual(
          uv.get("block-1")!.facesOf(),
          before,
          `${shapeId} lost face geometry through serialization`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("collapses a pole onto its largest face, not its smallest", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("pole"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      uv.collapse("block-1");

      const region = uv.get("block-1")!;
      assert.equal(region.collapsedFace, "left");
      assert.deepEqual(region.rectFor("front"), {
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

  it("collapses onto the tile the block already used", () => {
    for (const shapeId of ["cube", "pole", "slabBottom"]) {
      const { engine } = makeFakeVoxelEngine();
      engine.blockRegistry.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, engine);
      try {
        bridge.setActiveTileset("atlas", 16);

        uv.collapse("block-1");

        const { defaultTexture } = engine.blockRegistry.get(1)!;
        assert.deepEqual(
          { col: defaultTexture!.col, row: defaultTexture!.row },
          { col: 2, row: 1 },
          `${shapeId} moved off its tile when collapsed`
        );
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("tracks the triangle a ramp gives a face", () => {
    const { engine } = makeFakeVoxelEngine();
    engine.blockRegistry.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine);
    try {
      bridge.setActiveTileset("atlas", 16);

      engine.defineBlock(shapedBlock("ramp"));
      uv.uncollapse("block-1");

      assert.deepEqual(uv.get("block-1")!.geometryFor("left"), {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 32, y: 16, width: 16, height: 16 }
      });
    }
    finally {
      bridge.dispose();
    }
  });
});
