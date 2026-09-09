// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelArtState } from "#src/asset/PixelArtState.ts";
import type { UVRegionData } from "#src/uv/UVRegion.ts";

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

    assert.deepEqual(state.buffer.size(), { x: 4, y: 3 });
    assert.deepEqual(state.toJSON().size, { x: 4, y: 3 });
    assert.equal(state.toJSON().version, 1);
  });

  test("round-trips a document through toJSON and load", () => {
    const source = new PixelArtState({ x: 2, y: 2 });
    source.buffer.drawPixels(
      [{ x: 1, y: 0 }],
      {
        r: 9,
        g: 8,
        b: 7,
        a: 255
      }
    );
    source.buffer.uvRegions.set(kRegion);

    const target = new PixelArtState({ x: 1, y: 1 });
    target.load(source.toJSON());

    assert.deepEqual(target.buffer.size(), { x: 2, y: 2 });
    assert.deepEqual(target.buffer.pixels(), source.buffer.pixels());
    assert.deepEqual(
      [...target.buffer.uvRegions].map((region) => region.toJSON()),
      [...source.buffer.uvRegions].map((region) => region.toJSON())
    );
  });

  test("clear resets to the default size and drops uv regions", () => {
    const state = new PixelArtState({ x: 2, y: 2 });

    state.load(new PixelArtState({ x: 4, y: 4 }).toJSON());
    state.buffer.drawPixels(
      [{ x: 0, y: 0 }],
      {
        r: 1,
        g: 2,
        b: 3,
        a: 255
      }
    );
    state.buffer.uvRegions.set(kRegion);

    state.clear();

    assert.deepEqual(state.buffer.size(), { x: 2, y: 2 });
    assert.deepEqual(
      state.buffer.pixels(),
      new Uint8ClampedArray(2 * 2 * 4)
    );
    assert.deepEqual([...state.buffer.uvRegions], []);
  });
});
