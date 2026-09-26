// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";
import {
  createPixelArtDocument,
  decodePixelArtDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PIXEL_ART_KIND,
  createPixelArtAsset,
  pixelArtRoom
} from "#src/network/client.ts";
import { MockRoom } from "../helpers/room.ts";

describe("pixelArtRoom", () => {
  test("opens the pixel-art room of the asset", () => {
    const opened: string[] = [];
    const client = {
      room(name: string) {
        opened.push(name);

        return new MockRoom();
      }
    };

    pixelArtRoom(client, "asset-1");

    assert.deepEqual(opened, [`${PIXEL_ART_KIND}:asset-1`]);
  });
});

describe("createPixelArtAsset", () => {
  test("creates an encoded pixel-art document with a suffixed path on conflict", async() => {
    const calls: [string, Uint8Array, CatalogCreateOptions | undefined][] = [];
    const catalog = {
      async create(
        path: string,
        content: Uint8Array,
        options?: CatalogCreateOptions
      ) {
        calls.push([path, content, options]);

        return "asset-2";
      }
    };
    const document = createPixelArtDocument({
      x: 2,
      y: 3
    });

    const assetId = await createPixelArtAsset(catalog, "art.pixelart", document);

    assert.equal(assetId, "asset-2");
    assert.equal(calls.length, 1);
    const [path, content, options] = calls[0];
    assert.equal(path, "art.pixelart");
    assert.deepEqual(decodePixelArtDocument(content).size, {
      x: 2,
      y: 3
    });
    assert.deepEqual(options, {
      kind: PIXEL_ART_KIND,
      onConflict: "suffix"
    });
  });
});
