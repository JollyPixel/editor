// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Face } from "@jolly-pixel/voxel.renderer";
import type { UVCompound } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../src/features/texture/BlockUvBridge.ts";
import {
  makeFakeVoxelRenderer,
  makeUv
} from "./blockUvFixtures.ts";

// CONSTANTS
const kStairSlots = [
  "front",
  "back",
  "back.1",
  "left",
  "right",
  "top",
  "top.1",
  "bottom"
];

function setup(
  faceTextures: Record<string, unknown> = {}
) {
  const { vr } = makeFakeVoxelRenderer();
  const uv = makeUv();

  vr.engine.defineBlock({
    id: 1,
    name: "Stair",
    shapeId: "stair",
    collidable: true,
    faceTextures,
    defaultTexture: { col: 0, row: 0, tilesetId: "atlas" }
  } as never);

  return { vr, uv };
}

describe("BlockUvBridge — stairs", () => {
  it("gives a stair region every slot its shape emits", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;

      assert.deepEqual(
        region.facesOf().map(({ face }) => face),
        kStairSlots,
        "eight quads across six faces become eight editable slots"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("draws the side of a stair as its L-shaped coverage", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const geometry = uv.get("block-1")!.geometryFor("right") as UVCompound;

      assert.equal(geometry.shape, "compound");
      assert.equal(geometry.parts.length, 2);
      assert.deepEqual(
        geometry.rect,
        { x: 0, y: 0, width: 16, height: 16 },
        "the L's bounds still span one tile"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("leaves the notch of the L outside the region", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;
      const covered = region.facesOf().filter(
        ({ face }) => face === "right"
      );

      assert.equal(covered.length, 1);
    }
    finally {
      bridge.dispose();
    }
  });

  it("gives a tread and a riser the footprint of a slab side", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;

      assert.deepEqual(
        region.rectFor("top"),
        { x: 0, y: 0, width: 16, height: 8 },
        "a half-depth quad takes half a tile, or its texture is squashed"
      );
      assert.deepEqual(
        region.rectFor("top.1"),
        { x: 0, y: 8, width: 16, height: 8 },
        "the tread sits below it, so the pair covers the tile without overlap"
      );
      assert.deepEqual(
        region.rectFor("back"),
        { x: 0, y: 8, width: 16, height: 8 }
      );
      assert.deepEqual(
        region.rectFor("back.1"),
        { x: 0, y: 0, width: 16, height: 8 }
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes one tile per slot when a slot moves", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.uncollapse("block-1");
      uv.move("block-1", { x: 48, y: 40, width: 16, height: 8 }, "top.1");

      const updated = vr.engine.blockRegistry.get(1)!;

      assert.deepEqual(
        {
          col: updated.faceTextures["top.1"].col,
          row: updated.faceTextures["top.1"].row
        },
        { col: 3, row: 2 },
        "the tread moved to its own tile"
      );
      assert.deepEqual(
        {
          col: updated.faceTextures.top.col,
          row: updated.faceTextures.top.row
        },
        { col: 0, row: 0 },
        "the platform above it stayed put"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("collapses onto the whole tile, not the partial slot that was selected", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.collapse("block-1", "top.1");

      const region = uv.get("block-1")!;

      assert.equal(region.collapsedFace, "front");
      assert.deepEqual(
        region.rectFor("top.1"),
        { x: 0, y: 0, width: 16, height: 16 },
        "a 16x8 tread must not become the block's shared rectangle"
      );

      const { defaultTexture } = vr.engine.blockRegistry.get(1)!;
      assert.deepEqual(
        { col: defaultTexture!.col, row: defaultTexture!.row },
        { col: 0, row: 0 }
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("uncollapses a moved stair back onto the shape's own slot footprints", () => {
    const { vr, uv } = setup();
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);
      uv.move("block-1", { x: 48, y: 40, width: 16, height: 8 }, "top.1");
      uv.collapse("block-1");
      uv.move("block-1", { x: 32, y: 16, width: 16, height: 16 });
      uv.uncollapse("block-1");

      const region = uv.get("block-1")!;

      assert.deepEqual(
        region.rectFor("top"),
        { x: 32, y: 16, width: 16, height: 8 }
      );
      assert.deepEqual(
        region.rectFor("top.1"),
        { x: 32, y: 24, width: 16, height: 8 },
        "the tread must return to its half of the tile the region now sits on"
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("rebuilds a legacy stair, inheriting derived slots from their base", () => {
    const { vr, uv } = setup({
      [Face.PosY]: { col: 2, row: 1, tilesetId: "atlas" }
    });
    const bridge = new BlockUvBridge(uv, vr);

    try {
      bridge.setActiveTileset("atlas", 16);

      const region = uv.get("block-1")!;

      assert.deepEqual(
        region.rectFor("top"),
        { x: 32, y: 16, width: 16, height: 8 }
      );
      assert.deepEqual(
        region.rectFor("top.1"),
        { x: 32, y: 24, width: 16, height: 8 },
        "the two halves stack back into the tile the face always had"
      );
    }
    finally {
      bridge.dispose();
    }
  });
});
