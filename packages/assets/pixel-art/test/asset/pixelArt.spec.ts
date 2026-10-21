// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pixelArtAssetKind } from "#src/asset/pixelArtAssetKind.ts";
import { opaquePng } from "../helpers/png.ts";

async function convertPng(
  png: Uint8Array
): Promise<Uint8Array> {
  const conversion = pixelArtAssetKind().conversions?.[".png"];
  assert.ok(conversion);

  return conversion(png);
}

describe("pixelArtAssetKind .png conversion", () => {
  test("encodes the image as content the kind loads", async() => {
    const handler = pixelArtAssetKind();
    const state = handler.create("texture");
    handler.load(state, await convertPng(opaquePng(3, 2)));

    assert.deepEqual(state.document.buffer.size(), { x: 3, y: 2 });
    assert.equal(state.document.buffer.pixels()[3], 255);
  });

  test("refuses an image wider than the textures the kind loads", async() => {
    await assert.rejects(convertPng(opaquePng(2049, 1)), RangeError);
  });
});
