// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetId,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  TiledMapAssetLoader,
  TiledMapAssetType
} from "../../../src/plugins/tiled/loader.ts";
import type { TiledMap } from "../../../src/plugins/tiled/types.ts";

test("TiledMapAssetLoader prepares a catalog record", async(context) => {
  const map: TiledMap = {
    version: "1.10",
    infinite: false,
    orientation: "orthogonal",
    nextlayerid: 1,
    nextobjectid: 1,
    width: 1,
    height: 1,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [],
    layers: []
  };
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    async() => new Response(JSON.stringify(map))
  );
  const record = new AssetRecord({
    id: new AssetId("map.intro"),
    kind: TiledMapAssetType.kind,
    source: "maps/intro.tmj"
  });

  const asset = await new TiledMapAssetLoader().load(record);

  assert.strictEqual(
    fetchMock.mock.calls[0]?.arguments[0],
    record.source
  );
  assert.strictEqual(asset.world.version, 1);
  assert.strictEqual(asset.tilesetLoader.tilesets.size, 0);
});
