// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  UnsupportedAssetManifestError
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  resolveRuntimeAssetOptions
} from "../src/assets/resolveRuntimeAssetOptions.ts";

describe("resolveRuntimeAssetOptions", () => {
  test("keeps an existing catalog", async() => {
    const catalog = new AssetCatalog();
    const resolved = await resolveRuntimeAssetOptions({
      catalog
    });

    assert.strictEqual(resolved.catalog, catalog);
  });

  test("fetches and parses a catalog path", async(context) => {
    const fetchMock = context.mock.method(
      globalThis,
      "fetch",
      async() => new Response(JSON.stringify({
        version: 1,
        assets: [
          {
            id: "hero-model",
            kind: "model",
            source: "models/hero.glb"
          }
        ]
      }))
    );

    const resolved = await resolveRuntimeAssetOptions({
      catalog: "/assets.json"
    });

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    assert.strictEqual(
      fetchMock.mock.calls[0].arguments[0],
      "/assets.json"
    );
    assert.strictEqual(resolved.catalog.size, 1);
  });

  test("reports an unsuccessful catalog response", async(context) => {
    context.mock.method(
      globalThis,
      "fetch",
      async() => new Response(null, {
        status: 404,
        statusText: "Not Found"
      })
    );

    await assert.rejects(
      () => resolveRuntimeAssetOptions({
        catalog: "/missing-assets.json"
      }),
      /Asset catalog.*404 Not Found/
    );
  });

  test("rejects invalid catalog JSON", async(context) => {
    context.mock.method(
      globalThis,
      "fetch",
      async() => new Response("invalid JSON")
    );

    await assert.rejects(
      () => resolveRuntimeAssetOptions({
        catalog: "/assets.json"
      }),
      SyntaxError
    );
  });

  test("parses fetched manifests before returning", async(context) => {
    context.mock.method(
      globalThis,
      "fetch",
      async() => new Response(JSON.stringify({
        version: 2,
        assets: []
      }))
    );

    await assert.rejects(
      () => resolveRuntimeAssetOptions({
        catalog: new URL("https://example.com/assets.json")
      }),
      UnsupportedAssetManifestError
    );
  });
});
