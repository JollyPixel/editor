// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetCatalog,
  AssetId,
  AssetKindMismatchError,
  AssetKindNotFoundError,
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

describe("AssetCatalog kind lookup", () => {
  function catalogOf(
    ...kinds: string[]
  ): AssetCatalog {
    return new AssetCatalog(
      kinds.map((kind, index) => new AssetRecord({
        id: `asset-${index}`,
        kind,
        source: `project:/asset-${index}`
      }))
    );
  }

  test("byKind yields matching records in insertion order", () => {
    const catalog = catalogOf("model", "texture", "model");

    assert.deepEqual(
      Array.from(
        catalog.byKind("model"),
        (record) => record.id.value
      ),
      ["asset-0", "asset-2"]
    );
  });

  test("byKind yields nothing for an unknown kind", () => {
    assert.deepEqual(
      Array.from(catalogOf("model").byKind("texture")),
      []
    );
  });

  test("byKind is lazy", () => {
    const catalog = catalogOf("model", "model");
    const iterator = catalog.byKind("model");

    assert.equal(iterator.next().value?.id.value, "asset-0");
    catalog.remove(new AssetId("asset-1"));
    assert.equal(iterator.next().done, true);
  });

  test("firstOfKind returns the first matching record", () => {
    const catalog = catalogOf("texture", "model", "model");

    assert.equal(
      catalog.firstOfKind("model").id.value,
      "asset-1"
    );
  });

  test("firstOfKind throws when no record matches", () => {
    assert.throws(
      () => catalogOf("model").firstOfKind("texture"),
      (error: AssetKindNotFoundError) => {
        assert.ok(error instanceof AssetKindNotFoundError);
        assert.equal(error.name, "AssetKindNotFoundError");
        assert.equal(
          error.message,
          'The catalog holds no "texture" asset.'
        );
        assert.equal(error.kind, "texture");

        return true;
      }
    );
  });
});
