// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  BlockShapeRegistry,
  type ResolvedBlockDefinition,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type {
  SelectionRect,
  UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  BlockAlphaModes,
  type BlocksetPixels
} from "../../../src/features/blocksets/BlockAlphaModes.ts";

function makeBlock(
  id: number,
  col: number,
  patch: Partial<ResolvedBlockDefinition> = {}
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    properties: {},
    faceTextures: {},
    defaultTexture: { col, row: 0, blocksetId: "atlas" },
    ...patch
  };
}

function makePixels(
  transparentTiles: Set<number>
): BlocksetPixels {
  return {
    tileSize: 16,
    pixels: {
      hasTransparency: (geometry: UVGeometry) => {
        const rect: SelectionRect = "rect" in geometry ? geometry.rect : geometry;

        return transparentTiles.has(rect.x / 16);
      }
    }
  };
}

function setup(
  transparentTiles = new Set<number>(),
  loaded = new Set(["atlas"])
) {
  const blocks = new BlockRegistry();
  const view = {
    shapes: BlockShapeRegistry.createDefault(),
    document: { blocks }
  } as unknown as VoxelView;
  const pixels = makePixels(transparentTiles);
  const alphaModes = new BlockAlphaModes({
    view,
    resolvePixels: (blocksetId) => (loaded.has(blocksetId) ? pixels : undefined)
  });

  return { blocks, alphaModes };
}

describe("BlockAlphaModes.resolve", () => {
  it("sets a cutout on a block whose tile shows transparency", () => {
    const { alphaModes } = setup(new Set([1]));

    assert.equal(alphaModes.resolve(makeBlock(1, 1)).alphaMode, "mask");
    assert.equal(
      alphaModes.resolve(makeBlock(1, 1, { alphaMode: "opaque" })).alphaMode,
      "mask"
    );
  });

  it("never changes a blended block", () => {
    const { alphaModes } = setup(new Set([1]));

    for (const col of [0, 1]) {
      assert.equal(
        alphaModes.resolve(makeBlock(1, col, { alphaMode: "blend" })).alphaMode,
        "blend"
      );
    }
  });

  it("returns an opaque block as it is", () => {
    const { alphaModes } = setup();

    assert.equal(alphaModes.resolve(makeBlock(1, 0)).alphaMode, undefined);
    assert.equal(
      alphaModes.resolve(makeBlock(1, 0, { alphaMode: "mask" })).alphaMode,
      "opaque"
    );
  });

  it("reads the default blockset for texture refs that name none", () => {
    const { alphaModes } = setup(new Set([1]));
    const block = makeBlock(1, 1, { defaultTexture: { col: 1, row: 0 } });

    assert.equal(alphaModes.resolve(block, "atlas").alphaMode, "mask");
    assert.deepEqual(
      alphaModes.resolve(block, "atlas").defaultTexture,
      { col: 1, row: 0 }
    );
  });

  it("keeps the mode while a blockset the block reads is not loaded", () => {
    const { alphaModes } = setup(new Set([1]), new Set());

    assert.equal(alphaModes.resolve(makeBlock(1, 1)).alphaMode, undefined);
    assert.equal(
      alphaModes.resolve(makeBlock(1, 0, { alphaMode: "mask" })).alphaMode,
      "mask"
    );
  });
});

describe("BlockAlphaModes.staleIn", () => {
  it("lists only the blocks whose mode no longer matches their pixels", () => {
    const { blocks, alphaModes } = setup(new Set([1, 2]));
    blocks.register(makeBlock(1, 0));
    blocks.register(makeBlock(2, 1));
    blocks.register(makeBlock(3, 2, { alphaMode: "mask" }));
    blocks.register(makeBlock(4, 1, { alphaMode: "blend" }));

    assert.deepEqual(
      alphaModes.staleIn("atlas").map(({ id, alphaMode }) => [id, alphaMode]),
      [[2, "mask"]]
    );
  });

  it("skips the blocks outside the painted bounds", () => {
    const { blocks, alphaModes } = setup(new Set([1, 2]));
    blocks.register(makeBlock(1, 1));
    blocks.register(makeBlock(2, 2));

    const bounds = { x: 32, y: 0, width: 4, height: 4 };
    assert.deepEqual(
      alphaModes.staleIn("atlas", bounds).map(({ id }) => id),
      [2]
    );
  });

  it("is empty for a blockset that is not loaded", () => {
    const { blocks, alphaModes } = setup(new Set([1]), new Set());
    blocks.register(makeBlock(1, 1));

    assert.deepEqual(alphaModes.staleIn("atlas"), []);
  });
});
