// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  createBlocksetAsset,
  createBlocksetDocument,
  BLOCKSET_KIND,
  blocksetRoom
} from "#src/network/client.ts";
import { decodeBlocksetDocument } from "#src/asset/blocksetAssetKind.ts";
import { createMockBlocksetRoom } from "../../helpers/blocksetRoom.ts";

describe("blocksetRoom", () => {
  test("opens the blockset room of the asset", () => {
    const opened: string[] = [];
    const client = {
      room(name: string) {
        opened.push(name);

        return createMockBlocksetRoom();
      }
    };

    blocksetRoom(client, "asset-1");

    assert.deepEqual(opened, [`${BLOCKSET_KIND}:asset-1`]);
  });
});

describe("createBlocksetAsset", () => {
  test("creates an encoded blockset with a suffixed path on conflict", async() => {
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
    const document = createBlocksetDocument({
      tileSize: 8,
      size: { x: 16, y: 8 }
    });

    const assetId = await createBlocksetAsset(
      catalog,
      "textures/stone.blockset.json",
      document
    );

    assert.equal(assetId, "asset-2");
    assert.equal(calls.length, 1);
    const [path, content, options] = calls[0];
    assert.equal(path, "textures/stone.blockset.json");
    assert.deepEqual(decodeBlocksetDocument(content), document);
    assert.deepEqual(options, {
      kind: BLOCKSET_KIND,
      onConflict: "suffix"
    });
  });
});
