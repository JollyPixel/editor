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
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
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

  it("sizes a pole region to the width of the pole", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("pole"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

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
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("slabBottom"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

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

  it("keeps every shape's faces on the tile they came from once freed", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shape.id));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
        uv.setState("block-1", "free");

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
        bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
        uv.setState("block-1", "free");

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
            sortedRects(piecesOf(region.geometryFor(slot.id))),
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")!.rectFor("front").width, 16);

      view.document.defineBlock(shapedBlock("pole"));
      uv.setState("block-1", "free");

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

  it("keeps a region stacked when the block changes to a non-box shape", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("cube"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      assert.equal(uv.get("block-1")!.state, "stacked");

      view.document.defineBlock(shapedBlock("stair"));

      const region = uv.get("block-1")!;
      assert.equal(
        region.state,
        "stacked",
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

  it("keeps every face's size across a stack round-trip", () => {
    for (const { id: shapeId } of BlockShapeRegistry.createDefault()) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
        uv.setState("block-1", "free");
        const before = uv.get("block-1")!.slotsOf();

        uv.setState("block-1", "stacked");
        uv.setState("block-1", "free");

        assert.deepEqual(
          uv.get("block-1")!.slotsOf(),
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
        bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
        uv.setState("block-1", "free");
        const before = uv.get("block-1")!.slotsOf();

        uv.setState("block-1", "stacked");
        uv.restore(uv.get("block-1")!.toJSON());
        uv.setState("block-1", "free");

        assert.deepEqual(
          uv.get("block-1")!.slotsOf(),
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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      uv.setState("block-1", "stacked");

      const region = uv.get("block-1")!;
      assert.equal(region.stackedFace, "left");
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

  it("stacks onto the tile the block already used", () => {
    for (const shapeId of ["cube", "pole", "slabBottom"]) {
      const { view, bridgeOptions } = makeFakeVoxelEngine();
      view.document.blocks.register(shapedBlock(shapeId));

      const uv = makeUv();
      const bridge = new BlockUvBridge(uv, view, bridgeOptions);
      try {
        bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

        uv.setState("block-1", "stacked");

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
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      const region = uv.get("block-1")!;
      assert.equal(region.state, "stacked");
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

  it("gives a free ramp slope its true length", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("ramp"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

      const region = uv.get("block-1")!;
      assert.deepEqual(region.rectFor("top"), {
        x: 32,
        y: 16,
        width: 16,
        height: 23
      });
      assert.deepEqual(region.rectFor("front"), {
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

  it("gives an unfolded ramp slope its true length", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(shapedBlock("ramp"));

    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "unfolded");

      const region = uv.get("block-1")!;
      assert.equal(region.state, "unfolded");
      assert.deepEqual(region.geometryFor("top"), {
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

function piecesOf(
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
