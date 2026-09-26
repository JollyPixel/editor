// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodePixelArtDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  createPixelArtDocument,
  pixelArtDocumentFromPng
} from "#src/asset/pixelArt.ts";
import { pixelArtAssetKind } from "#src/asset/pixelArtAssetKind.ts";
import { opaquePng } from "../helpers/png.ts";

describe("createPixelArtDocument", () => {
  test("encodes a transparent document of the given size", async() => {
    const content = createPixelArtDocument({ x: 4, y: 2 });
    const handler = pixelArtAssetKind({ defaultSize: { x: 4, y: 2 } });

    assert.deepEqual(
      decodePixelArtDocument(content),
      decodePixelArtDocument(
        await handler.serialize(handler.create("texture"))
      )
    );
  });
});

describe("pixelArtDocumentFromPng", () => {
  test("encodes the image and reports its size", async() => {
    const { size, content } = await pixelArtDocumentFromPng(opaquePng(3, 2));
    const state = pixelArtAssetKind().create("texture");
    pixelArtAssetKind().load(state, content);

    assert.deepEqual(size, { x: 3, y: 2 });
    assert.deepEqual(state.buffer.size(), { x: 3, y: 2 });
    assert.equal(state.buffer.pixels()[3], 255);
  });
});
