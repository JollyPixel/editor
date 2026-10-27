// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ColorPalette,
  type UVRegionData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelArtState } from "#src/asset/pixelArtAssetKind.ts";

// CONSTANTS
const kRegion: UVRegionData = {
  state: "stacked",
  id: "region-1",
  color: "#ff0000",
  rect: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  }
};

describe("PixelArtState", () => {
  test("starts at the provided default size", () => {
    const state = new PixelArtState({ x: 4, y: 3 });

    assert.deepEqual(state.document.buffer.size(), { x: 4, y: 3 });
    assert.deepEqual(state.toJSON().size, { x: 4, y: 3 });
    assert.equal(state.toJSON().version, 1);
  });

  test("round-trips a document through toJSON and load", () => {
    const source = new PixelArtState({ x: 2, y: 2 });
    source.document.buffer.drawPixels(
      [{ x: 1, y: 0 }],
      {
        r: 9,
        g: 8,
        b: 7,
        a: 255
      }
    );
    source.document.uv.restore(kRegion);

    const target = new PixelArtState({ x: 1, y: 1 });
    target.load(source.toJSON());

    assert.deepEqual(target.document.buffer.size(), { x: 2, y: 2 });
    assert.deepEqual(target.document.buffer.pixels(), source.document.buffer.pixels());
    assert.deepEqual(
      [...target.document.uv].map((region) => region.toJSON()),
      [...source.document.uv].map((region) => region.toJSON())
    );
  });

  test("clear erases the pixels at the current size, uv regions and palette edits", () => {
    const state = new PixelArtState({ x: 2, y: 2 });

    state.load(new PixelArtState({ x: 4, y: 4 }).toJSON());
    state.document.buffer.drawPixels(
      [{ x: 0, y: 0 }],
      {
        r: 1,
        g: 2,
        b: 3,
        a: 255
      }
    );
    state.document.uv.restore(kRegion);
    state.document.apply({
      action: "palette-color-changed",
      metadata: {
        index: 0,
        color: {
          r: 9,
          g: 9,
          b: 9,
          a: 255
        }
      }
    });

    state.clear();

    assert.deepEqual(state.document.buffer.size(), { x: 4, y: 4 });
    assert.deepEqual(
      state.document.buffer.pixels(),
      new Uint8ClampedArray(4 * 4 * 4)
    );
    assert.deepEqual([...state.document.uv], []);
    assert.deepEqual(state.document.palette.toJSON(), ColorPalette.create().toJSON());
  });
});
