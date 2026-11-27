// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  pixelArtAssetKind,
  type PixelArtState
} from "#src/index.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

async function reloaded(
  state: PixelArtState
): Promise<PixelArtState> {
  const handler = pixelArtAssetKind();
  const copy = handler.create("texture");
  handler.load(copy, await handler.serialize(state));

  return copy;
}

describe("pixelArtAssetKind summarizeChange", () => {
  test("counts the pixels whose color changed, or names the new size", async() => {
    const handler = pixelArtAssetKind();
    const before = handler.create("texture");
    before.document.buffer.drawPixels([{ x: 0, y: 0 }], kRed);
    const after = await reloaded(before);

    assert.equal(handler.summarizeChange?.(before, after), null);

    after.document.buffer.drawPixels([{ x: 1, y: 0 }, { x: 2, y: 3 }], kRed);
    assert.equal(handler.summarizeChange?.(before, after), "2 pixels changed");

    after.document.buffer.resize({ x: 64, y: 32 });
    assert.equal(handler.summarizeChange?.(before, after), "resized from 32×32 to 64×32");
  });
});
