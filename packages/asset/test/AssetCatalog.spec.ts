// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetCatalog,
  AssetId,
  AssetKindMismatchError,
  AssetRecord,
  AssetReference,
  AssetType
} from "../src/index.ts";

describe("AssetCatalog", () => {
  test("round-trips a versioned manifest", () => {
    const catalog = new AssetCatalog([
      new AssetRecord({
        id: "hero-model",
        kind: "model",
        source: "project:/models/hero.glb",
        revision: "sha256:abc"
      })
    ]);

    const restored = AssetCatalog.parse(catalog.toJSON());
    const record = restored.get(
      new AssetId("hero-model")
    );

    assert.equal(record.source, "project:/models/hero.glb");
    assert.equal(record.revision, "sha256:abc");
    assert.deepEqual(
      restored.toJSON(),
      catalog.toJSON()
    );
  });

  test("rejects duplicate identifiers", () => {
    const catalog = new AssetCatalog();
    const record = new AssetRecord({
      id: "hero-model",
      kind: "model",
      source: "project:/models/hero.glb"
    });
    catalog.add(record);

    assert.throws(
      () => catalog.add(record),
      /already exists/
    );
  });

  test("iterates over records in insertion order", () => {
    const first = new AssetRecord({
      id: "hero-model",
      kind: "model",
      source: "project:/models/hero.glb"
    });
    const second = new AssetRecord({
      id: new AssetId("theme-music"),
      kind: "audio",
      source: "project:/audio/theme.ogg"
    });
    const catalog = new AssetCatalog([
      first,
      second
    ]);

    assert.deepEqual(
      Array.from(catalog),
      [first, second]
    );

    const copiedCatalog = new AssetCatalog(catalog);
    assert.deepEqual(
      Array.from(copiedCatalog),
      [first, second]
    );
  });

  test("validates the kind expected by a scene reference", () => {
    const catalog = new AssetCatalog([
      new AssetRecord({
        id: new AssetId("hero-model"),
        kind: "model",
        source: "project:/models/hero.glb"
      })
    ]);
    const reference = new AssetReference(
      new AssetId("hero-model"),
      new AssetType<unknown>("audio")
    );

    assert.throws(
      () => catalog.resolve(reference),
      AssetKindMismatchError
    );
  });

  test("updates a source without changing its stable identifier", () => {
    const id = new AssetId("hero-model");
    const catalog = new AssetCatalog([
      new AssetRecord({
        id,
        kind: "model",
        source: "project:/models/hero.glb"
      })
    ]);

    catalog.replace(new AssetRecord({
      id,
      kind: "model",
      source: "project:/characters/hero.glb"
    }));

    assert.equal(
      catalog.get(id).source,
      "project:/characters/hero.glb"
    );
  });

  test("parses unknown persistence input", () => {
    assert.throws(
      () => AssetCatalog.parse({
        version: 1,
        assets: [{
          id: "hero-model",
          kind: "model"
        }]
      }),
      /source must be a string/
    );
    assert.throws(
      () => AssetCatalog.parse({
        version: 2,
        assets: []
      }),
      /version "2" is not supported/
    );
  });
});
