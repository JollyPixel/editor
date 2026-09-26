// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import {
  createTilesetAsset,
  createTilesetDocument,
  TILESET_KIND,
  tilesetRoom
} from "#src/network/client.ts";
import { decodeTilesetDocument } from "#src/asset/tilesetAssetKind.ts";
import { createMockTilesetRoom } from "../../helpers/tilesetRoom.ts";

describe("tilesetRoom", () => {
  test("opens the tileset room of the asset", () => {
    const opened: string[] = [];
    const client = {
      room(name: string) {
        opened.push(name);

        return createMockTilesetRoom();
      }
    };

    tilesetRoom(client, "asset-1");

    assert.deepEqual(opened, [`${TILESET_KIND}:asset-1`]);
  });
});

describe("createTilesetAsset", () => {
  test("creates an encoded tileset with a suffixed path on conflict", async() => {
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
    const document = createTilesetDocument({
      tileSize: 8,
      size: { x: 16, y: 8 }
    });

    const assetId = await createTilesetAsset(
      catalog,
      "textures/stone.tileset.json",
      document
    );

    assert.equal(assetId, "asset-2");
    assert.equal(calls.length, 1);
    const [path, content, options] = calls[0];
    assert.equal(path, "textures/stone.tileset.json");
    assert.deepEqual(decodeTilesetDocument(content), document);
    assert.deepEqual(options, {
      kind: TILESET_KIND,
      onConflict: "suffix"
    });
  });
});
