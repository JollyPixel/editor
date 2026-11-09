// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPreviewCache } from "../../../src/shell/assets/AssetPreviewCache.ts";
import { AssetPreviewController } from "../../../src/shell/assets/AssetPreviewController.ts";
import {
  FakePreviewCatalog,
  pngPreview,
  previewTarget
} from "../../helpers/previewCatalog.ts";

interface ShownPreview extends Disposable {
  readonly controller: AssetPreviewController;
  readonly catalog: FakePreviewCatalog;
  readonly cache: AssetPreviewCache;
}

function showPreview(
  assetId: string
): ShownPreview {
  const catalog = new FakePreviewCatalog();
  const cache = new AssetPreviewCache({ server: catalog, frame: catalog });
  const controller = new AssetPreviewController({
    requestUpdate: () => undefined
  });
  controller.show(cache, previewTarget(assetId));

  return {
    controller,
    catalog,
    cache,
    [Symbol.dispose]() {
      cache.dispose();
    }
  };
}

describe("AssetPreviewController", () => {
  test("loads without an image until the preview arrives", async() => {
    using shown = showPreview("grass");

    assert.strictEqual(shown.controller.url, null);
    assert.strictEqual(shown.controller.loading, true);

    await shown.catalog.reply("grass", pngPreview("grass"));

    assert.strictEqual(shown.controller.loading, false);
    assert.strictEqual(
      shown.controller.url,
      await shown.cache.load(previewTarget("grass"))
    );
  });

  test("shows no image for an asset without a preview", async() => {
    using shown = showPreview("grass");

    await shown.catalog.reply("grass", null);

    assert.strictEqual(shown.controller.url, null);
    assert.strictEqual(shown.controller.loading, false);
  });

  test("drops a preview that arrives after the selection changed", async() => {
    using shown = showPreview("grass");
    shown.controller.show(shown.cache, previewTarget("stone"));

    await shown.catalog.reply("stone", pngPreview("stone"));
    await shown.catalog.reply("grass", pngPreview("grass"));

    assert.strictEqual(
      shown.controller.url,
      await shown.cache.load(previewTarget("stone"))
    );
  });

  test("keeps the image while the next revision of the asset loads", async() => {
    using shown = showPreview("grass");
    await shown.catalog.reply("grass", pngPreview("r1"));
    const first = shown.controller.url;

    shown.controller.show(shown.cache, previewTarget("grass", "r2"));

    assert.strictEqual(shown.controller.url, first);

    await shown.catalog.reply("grass", pngPreview("r2"));

    assert.notStrictEqual(shown.controller.url, first);
    assert.strictEqual(
      shown.controller.url,
      await shown.cache.load(previewTarget("grass", "r2"))
    );
  });

  test("clears the image when another asset is selected", async() => {
    using shown = showPreview("grass");
    await shown.catalog.reply("grass", pngPreview("grass"));

    shown.controller.show(shown.cache, previewTarget("stone"));

    assert.strictEqual(shown.controller.url, null);
  });

  test("clears the image when the browser binds another catalog", async() => {
    using shown = showPreview("grass");
    await shown.catalog.reply("grass", pngPreview("grass"));
    using next = showPreview("stone");

    shown.controller.show(next.cache, previewTarget("grass"));

    assert.strictEqual(shown.controller.url, null);
  });
});
