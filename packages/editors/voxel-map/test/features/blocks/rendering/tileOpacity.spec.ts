// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlocksetList,
  BlocksetAtlases,
  type AtlasImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  readImagePixels,
  TileOpacityProbe,
  type PixelBuffer
} from "../../../../src/features/blocks/rendering/tileOpacity.ts";

// CONSTANTS
const kTileSize = 2;

function bufferOf(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[(((y * width) + x) * 4) + 3] = alphaAt(x, y);
    }
  }

  return {
    width,
    height,
    data
  };
}

function canvasOf(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function setup(
  pixels: PixelBuffer | null
) {
  const atlases = new BlocksetAtlases({
    blocksets: new BlocksetList([
      {
        id: "atlas",
        src: "atlas.png",
        tileSize: kTileSize
      }
    ])
  });
  const texture = new THREE.Texture<AtlasImage>(canvasOf(4, 2));
  atlases.registerTexture("atlas", texture);

  let reads = 0;
  const probe = new TileOpacityProbe(atlases, () => {
    reads++;

    return pixels;
  });

  return {
    texture,
    probe,
    reads: () => reads
  };
}

describe("readImagePixels", () => {
  it("returns null for an empty image", () => {
    assert.equal(readImagePixels(canvasOf(0, 0)), null);
  });

  it("returns null for an image without a decoded size", () => {
    assert.equal(readImagePixels(document.createElement("img")), null);
  });
});

describe("TileOpacityProbe", () => {
  const pixels = bufferOf(4, 2, (x) => (x < 2 ? 255 : 0));

  it("treats a missing tile ref as empty", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty(undefined, 0), true);
  });

  it("treats an unknown blockset as empty", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ blocksetId: "gone", col: 0, row: 0 }, 0), true);
  });

  it("reports transparent tiles as empty and painted ones as not", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ blocksetId: "atlas", col: 0, row: 0 }, 0), false);
    assert.equal(probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0 }, 0), true);
  });

  it("only sees the pixels at or above the alpha cutoff", () => {
    const { probe } = setup(bufferOf(4, 2, (x) => (x === 3 ? 128 : 0)));
    const tile = { blocksetId: "atlas", col: 1, row: 0 };

    assert.equal(probe.isEmpty(tile, 0.5), false);
    assert.equal(probe.isEmpty(tile, 0.6), true);
    assert.equal(probe.isEmpty({ ...tile, col: 0 }, 0), true);
  });

  it("clips a tile that runs past the image edge", () => {
    const { probe } = setup(bufferOf(4, 2, (x) => (x % 3 === 0 ? 255 : 0)));

    assert.equal(probe.isEmpty({ blocksetId: "atlas", col: 2, row: 0 }, 0), true);
    assert.equal(
      probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0, size: 4 }, 0),
      false
    );
  });

  it("falls back to the default blockset without a blockset id", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ col: 1, row: 0 }, 0), true);
  });

  it("reads the image once per texture version", () => {
    const { probe, texture, reads } = setup(pixels);

    probe.isEmpty({ blocksetId: "atlas", col: 0, row: 0 }, 0);
    probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0 }, 0);
    probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0 }, 0);
    assert.equal(reads(), 1);

    texture.needsUpdate = true;
    probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0 }, 0);
    assert.equal(reads(), 2);
  });

  it("treats an unreadable image as not empty", () => {
    const { probe } = setup(null);

    assert.equal(probe.isEmpty({ blocksetId: "atlas", col: 1, row: 0 }, 0), false);
  });
});
