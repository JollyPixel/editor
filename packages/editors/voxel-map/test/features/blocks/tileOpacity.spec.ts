// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  TilesetList,
  TilesetManager,
  type TilesetImage
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  hasVisiblePixel,
  readImagePixels,
  TileOpacityProbe,
  type PixelBuffer
} from "../../../src/features/blocks/tileOpacity.ts";

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
  const tilesetManager = new TilesetManager({
    tilesets: new TilesetList([
      {
        id: "atlas",
        src: "atlas.png",
        tileSize: kTileSize
      }
    ])
  });
  const texture = new THREE.Texture<TilesetImage>(canvasOf(4, 2));
  tilesetManager.registerTexture("atlas", texture);

  let reads = 0;
  const probe = new TileOpacityProbe(tilesetManager, () => {
    reads++;

    return pixels;
  });

  return {
    texture,
    probe,
    reads: () => reads
  };
}

describe("hasVisiblePixel", () => {
  const buffer = bufferOf(4, 2, (x) => (x === 3 ? 128 : 0));

  it("finds a pixel at or above the cutoff inside the rect", () => {
    assert.equal(hasVisiblePixel(buffer, { x: 2, y: 0, size: 2 }, 0.5), true);
  });

  it("ignores pixels below the cutoff", () => {
    assert.equal(hasVisiblePixel(buffer, { x: 2, y: 0, size: 2 }, 0.6), false);
  });

  it("never treats a zero alpha as visible", () => {
    assert.equal(hasVisiblePixel(buffer, { x: 0, y: 0, size: 2 }, 0), false);
  });

  it("clips a rect past the image bounds", () => {
    assert.equal(hasVisiblePixel(buffer, { x: 4, y: 0, size: 2 }, 0), false);
    assert.equal(hasVisiblePixel(buffer, { x: 3, y: -1, size: 2 }, 0), true);
  });
});

describe("readImagePixels", () => {
  it("returns null for an empty image", () => {
    assert.equal(readImagePixels(canvasOf(0, 0)), null);
  });

  it("returns null for an image without a decoded size", () => {
    assert.equal(readImagePixels(document.createElement("img")), null);
  });

  it("returns null when the canvas cannot hand back pixels", () => {
    assert.equal(readImagePixels(canvasOf(4, 2)), null);
  });
});

describe("TileOpacityProbe", () => {
  const pixels = bufferOf(4, 2, (x) => (x < 2 ? 255 : 0));

  it("treats a missing tile ref as empty", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty(undefined, 0), true);
  });

  it("treats an unknown tileset as empty", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ tilesetId: "gone", col: 0, row: 0 }, 0), true);
  });

  it("reports transparent tiles as empty and painted ones as not", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ tilesetId: "atlas", col: 0, row: 0 }, 0), false);
    assert.equal(probe.isEmpty({ tilesetId: "atlas", col: 1, row: 0 }, 0), true);
  });

  it("falls back to the default tileset without a tileset id", () => {
    const { probe } = setup(pixels);

    assert.equal(probe.isEmpty({ col: 1, row: 0 }, 0), true);
  });

  it("reads the image once per texture version", () => {
    const { probe, texture, reads } = setup(pixels);

    probe.isEmpty({ tilesetId: "atlas", col: 0, row: 0 }, 0);
    probe.isEmpty({ tilesetId: "atlas", col: 1, row: 0 }, 0);
    probe.isEmpty({ tilesetId: "atlas", col: 1, row: 0 }, 0);
    assert.equal(reads(), 1);

    texture.needsUpdate = true;
    probe.isEmpty({ tilesetId: "atlas", col: 1, row: 0 }, 0);
    assert.equal(reads(), 2);
  });

  it("treats an unreadable image as not empty", () => {
    const { probe } = setup(null);

    assert.equal(probe.isEmpty({ tilesetId: "atlas", col: 1, row: 0 }, 0), false);
  });
});
