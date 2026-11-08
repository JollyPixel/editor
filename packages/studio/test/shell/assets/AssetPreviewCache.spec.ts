// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPreviewCache } from "../../../src/shell/assets/AssetPreviewCache.ts";
import {
  FakePreviewCatalog,
  pngPreview,
  previewTarget
} from "../../helpers/previewCatalog.ts";

async function fetched(
  cache: AssetPreviewCache,
  catalog: FakePreviewCatalog,
  assetId: string
): Promise<string | null> {
  const loaded = cache.load(previewTarget(assetId));
  await catalog.reply(assetId, pngPreview(assetId));

  return loaded;
}

describe("AssetPreviewCache", () => {
  test("asks the catalog once per revision of an asset", async() => {
    const catalog = new FakePreviewCatalog();
    const cache = new AssetPreviewCache({ server: catalog, frame: catalog });

    const loads = [
      cache.load(previewTarget("grass", "r1")),
      cache.load(previewTarget("grass", "r1"))
    ];
    await catalog.reply("grass", pngPreview("r1"));
    const [first, second] = await Promise.all(loads);
    const again = await cache.load(previewTarget("grass", "r1"));

    assert.match(first ?? "", /^blob:/);
    assert.strictEqual(second, first);
    assert.strictEqual(again, first);
    assert.deepStrictEqual(catalog.requests, ["grass"]);

    const next = cache.load(previewTarget("grass", "r2"));
    await catalog.reply("grass", pngPreview("r2"));

    assert.notStrictEqual(await next, first);
    assert.deepStrictEqual(catalog.requests, ["grass", "grass"]);
    cache.dispose();
  });

  test("asks the source of each target", async() => {
    const catalog = new FakePreviewCatalog();
    const frame = new FakePreviewCatalog();
    const cache = new AssetPreviewCache({ server: catalog, frame });

    const model = cache.load(previewTarget("model", "r1", "frame"));
    await frame.reply("model", pngPreview("model"));

    assert.match(await model ?? "", /^blob:/);
    assert.deepStrictEqual(frame.requests, ["model"]);
    assert.deepStrictEqual(catalog.requests, []);
    cache.dispose();
  });

  test("revokes the least recently used preview past its capacity", async(t) => {
    const revoke = t.mock.method(URL, "revokeObjectURL");
    const catalog = new FakePreviewCatalog();
    const cache = new AssetPreviewCache({ server: catalog, frame: catalog }, 2);

    await fetched(cache, catalog, "a");
    const urlB = await fetched(cache, catalog, "b");
    await cache.load(previewTarget("a"));
    await fetched(cache, catalog, "c");

    assert.deepStrictEqual(
      revoke.mock.calls.map((call) => call.arguments[0]),
      [urlB]
    );
    cache.dispose();
  });

  test("dispose revokes every preview and drops one still on its way", async(t) => {
    const revoke = t.mock.method(URL, "revokeObjectURL");
    const catalog = new FakePreviewCatalog();
    const cache = new AssetPreviewCache({ server: catalog, frame: catalog });
    const urlA = await fetched(cache, catalog, "a");
    const loadedB = cache.load(previewTarget("b"));

    cache.dispose();
    await catalog.reply("b", pngPreview("b"));

    assert.deepStrictEqual(
      revoke.mock.calls.map((call) => call.arguments[0]),
      [urlA]
    );
    assert.strictEqual(await loadedB, null);
  });
});
