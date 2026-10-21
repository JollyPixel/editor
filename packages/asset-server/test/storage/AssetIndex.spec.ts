// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { ASSET_INDEX_PATH } from "#src/index.ts";
import { AssetIndex } from "#src/storage/AssetIndex.ts";
import { bytes } from "../helpers/bytes.ts";
import { recordingLogger } from "../helpers/logger.ts";

describe("AssetIndex — mapping", () => {
  test("indexes entries by path and by id", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assert.deepEqual(assetIndex.byPath("a.png"), {
      id: "1",
      path: "a.png",
      kind: "pixelart"
    });
    assert.strictEqual(assetIndex.byId("1")?.path, "a.png");
    assert.strictEqual(assetIndex.byPath("missing.png"), undefined);
  });

  test("re-setting an id moves it, dropping the previous path", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assetIndex.set({ id: "1", path: "b.png", kind: "pixelart" });

    assert.strictEqual(assetIndex.byPath("a.png"), undefined);
    assert.strictEqual(assetIndex.byPath("b.png")?.id, "1");
    assert.strictEqual(assetIndex.size, 1);
  });

  test("taking over a path drops the id that held it", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assetIndex.set({ id: "2", path: "a.png", kind: "pixelart" });

    assert.strictEqual(assetIndex.byId("1"), undefined);
    assert.strictEqual(assetIndex.byPath("a.png")?.id, "2");
    assert.strictEqual(assetIndex.size, 1);
    assert.deepEqual([...assetIndex], [
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);
  });

  test("a path is never serialized twice", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "1", path: "a.png", kind: "pixelart" },
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);

    assert.deepEqual(assetIndex.toJSON().assets, [
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);
  });

  test("removeById drops both indexes", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assert.strictEqual(assetIndex.removeById("1"), true);
    assert.strictEqual(assetIndex.removeById("1"), false);
    assert.strictEqual(assetIndex.size, 0);
    assert.strictEqual(assetIndex.byPath("a.png"), undefined);
  });

  test("serializes entries sorted by path", () => {
    const assetIndex = new AssetIndex(new MemoryAssetSource(), [
      { id: "2", path: "b.png", kind: "binary" },
      { id: "1", path: "a.png", kind: "binary" }
    ]);

    assert.deepEqual(assetIndex.toJSON(), {
      version: 1,
      assets: [
        { id: "1", path: "a.png", kind: "binary" },
        { id: "2", path: "b.png", kind: "binary" }
      ]
    });
  });
});

describe("AssetIndex — persistence", () => {
  test("round-trips through an AssetSource", async() => {
    const source = new MemoryAssetSource();
    const assetIndex = new AssetIndex(source, [
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    await assetIndex.save();
    const loaded = await AssetIndex.load(source);

    assert.deepEqual(loaded.toJSON(), assetIndex.toJSON());
  });

  test("writes to the reserved index path, outside the listing", async() => {
    const source = new MemoryAssetSource();

    await new AssetIndex(source).save();

    assert.deepEqual(await source.list(), []);
    assert.match(
      new TextDecoder().decode(await source.read(ASSET_INDEX_PATH)),
      /"assets"/
    );
  });

  test("a missing index loads as empty", async() => {
    const loaded = await AssetIndex.load(new MemoryAssetSource());

    assert.strictEqual(loaded.size, 0);
  });

  test("a truncated index loads as empty rather than throwing", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      ASSET_INDEX_PATH,
      bytes('{"version":1,"assets":[{"id":"1","path"')
    );

    const loaded = await AssetIndex.load(source);

    assert.strictEqual(loaded.size, 0);
  });

  test("a corrupt index drops only its malformed entries", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      ASSET_INDEX_PATH,
      bytes(JSON.stringify({
        version: 1,
        assets: [
          { id: "1", path: "a.png", kind: "binary" },
          { id: 2, path: "b.png", kind: "binary" },
          null
        ]
      }))
    );

    const loaded = await AssetIndex.load(source);

    assert.strictEqual(loaded.size, 1);
    assert.strictEqual(loaded.byPath("a.png")?.id, "1");
  });

  test("set stays in memory until save", async() => {
    const source = new MemoryAssetSource();

    const loaded = await AssetIndex.load(source);
    loaded.set({ id: "1", path: "a.png", kind: "binary" });

    assert.strictEqual(loaded.size, 1);
    await assert.rejects(source.read(ASSET_INDEX_PATH));
    assert.strictEqual((await AssetIndex.load(source)).size, 0);
  });
});

describe("AssetIndex — parse reporting", () => {
  test("reports no drop for a document it cannot read at all", () => {
    const { dropped, data } = AssetIndex.parse("nope");

    assert.strictEqual(dropped, 0);
    assert.deepEqual(data, []);
  });

  test("warns once when load drops entries", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      ASSET_INDEX_PATH,
      bytes(JSON.stringify({
        version: 1,
        assets: [
          { id: "1", path: "a.png", kind: "binary" },
          { id: 2, path: "b.png", kind: "binary" }
        ]
      }))
    );
    const { logger, records } = recordingLogger();

    await AssetIndex.load(source, logger);

    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].level, "warn");
    assert.strictEqual(records[0].metadata.dropped, 1);
  });

  test("stays silent when every entry parses", async() => {
    const source = new MemoryAssetSource();
    await new AssetIndex(source, [
      { id: "1", path: "a.png", kind: "binary" }
    ]).save();
    const { logger, records } = recordingLogger();

    await AssetIndex.load(source, logger);

    assert.deepEqual(records, []);
  });
});
