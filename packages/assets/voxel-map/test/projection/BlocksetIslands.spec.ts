// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  IslandMap,
  NormalMapConfig,
  NormalMapGenerator,
  type IslandFace
} from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockShapeRegistry,
  BlocksetDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BlocksetIslands,
  type BlocksetIslandsTarget
} from "#src/projection/BlocksetIslands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kSize = {
  x: 16,
  y: 16
};
const kFlat = [128, 128, 255, 255];

class RecordingTarget implements BlocksetIslandsTarget {
  faces: (() => Iterable<IslandFace>) | null = null;
  invalidations = 0;

  useIslandFaces(
    faces: () => Iterable<IslandFace>
  ): () => void {
    this.faces = faces;

    return () => {
      this.faces = null;
    };
  }

  invalidateIslands(): void {
    this.invalidations++;
  }
}

function setup() {
  const blockset = new BlocksetDocument({
    tileSize: 8,
    blocks: [
      makeBlockDef(1, "cube", { defaultTexture: { col: 0, row: 0 } }),
      makeBlockDef(2, "cube", { defaultTexture: { col: 1, row: 0 } })
    ]
  });
  const islands = new BlocksetIslands({
    blockset,
    shapes: BlockShapeRegistry.createDefault()
  });

  return {
    blockset,
    islands
  };
}

function islandMapOf(
  islands: BlocksetIslands
): IslandMap {
  return IslandMap.fromFaces(kSize, islands.faces());
}

function halfWhitePixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(kSize.x * kSize.y * 4);
  for (let y = 0; y < kSize.y; y++) {
    for (let x = 0; x < kSize.x; x++) {
      const value = x < 8 ? 255 : 0;
      pixels.set([value, value, value, 255], ((y * kSize.x) + x) * 4);
    }
  }

  return pixels;
}

function normalAt(
  pixels: Uint8ClampedArray,
  x: number,
  y: number
): number[] {
  const index = ((y * kSize.x) + x) * 4;

  return [...pixels.subarray(index, index + 4)];
}

describe("BlocksetIslands", () => {
  it("builds one island per block tile, keyed by region id", () => {
    const islands = islandMapOf(setup().islands);

    assert.deepEqual([...islands.islandAt(0, 0)!.regionIds], ["block-1"]);
    assert.deepEqual([...islands.islandAt(8, 0)!.regionIds], ["block-2"]);
    assert.equal(islands.islandAt(0, 8)!.isRemainder, true);
  });

  it("never lets the normal map sample across two block tiles", () => {
    const normals = NormalMapGenerator.generate({
      size: kSize,
      pixels: halfWhitePixels(),
      islands: islandMapOf(setup().islands),
      config: NormalMapConfig.create()
    });

    assert.deepEqual(normalAt(normals, 7, 4), kFlat);
    assert.deepEqual(normalAt(normals, 8, 4), kFlat);
  });

  it("hands its faces to the pixels it is attached to", () => {
    const { islands } = setup();
    const target = new RecordingTarget();

    islands.attachTo(target);

    assert.ok(target.faces);
    assert.deepEqual([...target.faces()], islands.faces());
  });

  it("invalidates the islands when a block moves or the blockset reloads", () => {
    const { blockset, islands } = setup();
    const target = new RecordingTarget();
    islands.attachTo(target);

    blockset.defineBlock(
      makeBlockDef(1, "cube", { defaultTexture: { col: 1, row: 1 } })
    );
    blockset.resizeTiles(4);
    blockset.clear();

    assert.equal(target.invalidations, 3);
    assert.deepEqual(islands.faces(), []);
  });

  it("keeps the islands on a material group change", () => {
    const { blockset, islands } = setup();
    const target = new RecordingTarget();
    islands.attachTo(target);

    blockset.defineMaterialGroup({ id: "gold", metalness: 1 });

    assert.equal(target.invalidations, 0);
  });

  it("gives the islands back and stops listening once released", () => {
    const { blockset, islands } = setup();
    const target = new RecordingTarget();
    const release = islands.attachTo(target);

    release();
    blockset.clear();

    assert.equal(target.faces, null);
    assert.equal(target.invalidations, 0);
  });
});
