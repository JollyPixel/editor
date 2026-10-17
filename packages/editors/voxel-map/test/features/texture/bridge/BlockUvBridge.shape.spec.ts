// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  shapeSlots,
  resolveTileRect,
  type FaceDefinition,
  type ResolvedBlockDefinition,
  type TileBounds,
  type TileRect
} from "@jolly-pixel/voxel.renderer";
import type { UVGeometry } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot,
  makeBlock
} from "./blockUvFixtures.ts";

function computeBounds(
  uvs: FaceDefinition["uvs"]
): TileBounds {
  const us = uvs.map(([u]) => u);
  const vs = uvs.map(([, v]) => v);

  return {
    u0: Math.min(...us),
    v0: Math.min(...vs),
    u1: Math.max(...us),
    v1: Math.max(...vs)
  };
}

function splitPieces(
  geometry: UVGeometry
): TileRect[] {
  if (!("shape" in geometry)) {
    return [geometry];
  }
  if (geometry.shape === "triangle") {
    return [geometry.rect];
  }

  const { rect } = geometry;

  return geometry.parts.map((part) => {
    const local = "shape" in part ? part.rect : part;

    return {
      x: rect.x + (local.x * rect.width),
      y: rect.y + (local.y * rect.height),
      width: local.width * rect.width,
      height: local.height * rect.height
    };
  });
}

function sortedRects(
  rects: readonly TileRect[]
): TileRect[] {
  return rects
    .map((rect) => {
      return {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height)
      };
    })
    .toSorted((a, b) => (a.x - b.x) || (a.y - b.y));
}

function round(
  value: number
): number {
  return Math.round(value * 1e6) / 1e6;
}

describe("BlockUvBridge / shape footprint", () => {
  function shapedBlock(
    shapeId: string
  ): ResolvedBlockDefinition {
    return {
      ...makeBlock(1, { col: 2, row: 1, blocksetId: "atlas" }),
      shapeId
    };
  }

  it("sizes a pole region to the width of the pole", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("pole"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.slotRect("top"), {
        x: 32 + 6,
        y: 16,
        width: 4,
        height: 16
      });
      assert.deepEqual(region.slotRect("front"), {
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
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("slabBottom"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      uv.applyState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.slotRect("front"), {
        x: 32,
        y: 16 + 8,
        width: 16,
        height: 8
      });
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

  it("keeps every shape's faces on the tile they came from once freed", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shape.id));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.activateBlockset(blocksetSlot("atlas"), 16);
        uv.applyState("block-1", "free");

        const { faceTextures } = view.document.blocks.get(1)!;
        assert.ok(
          Object.keys(faceTextures).length > 0,
          `${shape.id} wrote no face texture`
        );
        for (const tileRef of Object.values(faceTextures)) {
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

  it("outlines every slot where its mesh samples the tile, for every built-in shape", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shape.id));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.activateBlockset(blocksetSlot("atlas"), 16);
        uv.applyState("block-1", "free");

        const region = uv.get("block-1")!;
        const { faceTextures } = view.document.blocks.get(1)!;
        for (const slot of shapeSlots(shape)) {
          const sampled = slot.definitions.map(
            (definition) => resolveTileRect(
              faceTextures[slot.id],
              16,
              computeBounds(definition.uvs),
              slot.span
            )
          );

          assert.deepEqual(
            sortedRects(splitPieces(region.slotGeometry(slot.id))),
            sortedRects(sampled),
            `${shape.id} outlines "${slot.id}" away from its mesh`
          );
        }
      }
      finally {
        bridge.dispose();
      }
    }
  });

  it("resizes the region when the block changes shape", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")!.slotRect("front").width, 16);

      view.document.defineBlock(shapedBlock("pole"));
      uv.applyState("block-1", "free");

      assert.deepEqual(uv.get("block-1")!.slotRect("front"), {
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

  it("keeps a region stacked when the block changes to a non-box shape", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.activateBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")!.state, "stacked");

      view.document.defineBlock(shapedBlock("stair"));

      const region = uv.get("block-1")!;
      assert.equal(
        region.state,
        "stacked",
        "a shape change alone must not split the block into per-face textures"
      );
      assert.deepEqual(region.slotRect("front"), {
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
