// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetAlreadyExistsError,
  AssetCatalog,
  AssetId,
  AssetKindMismatchError,
  AssetNotFoundError,
  AssetRecord,
  AssetReference,
  AssetType,
  UnsupportedAssetManifestError
} from "../src/index.ts";

// CONSTANTS
const kHeroRecord = {
  id: "hero-model",
  kind: "model",
  source: "project:/models/hero.glb",
  revision: "sha256:abc"
};
const kManifest = {
  version: 1,
  assets: [kHeroRecord]
};

function heroRecord(
  source = kHeroRecord.source
): AssetRecord {
  return new AssetRecord({
    id: kHeroRecord.id,
    kind: kHeroRecord.kind,
    source
  });
}

describe("AssetCatalog", () => {
  test("serializes records into a versioned manifest", () => {
    const catalog = new AssetCatalog([
      new AssetRecord(kHeroRecord)
    ]);

    assert.deepEqual(catalog.toJSON(), kManifest);
  });

  test("restores records from a manifest", () => {
    const record = AssetCatalog.parse(kManifest).get(
      new AssetId("hero-model")
    );

    assert.equal(record.kind, "model");
    assert.equal(record.source, "project:/models/hero.glb");
    assert.equal(record.revision, "sha256:abc");
  });

  test("rejects malformed manifests with a ZodError", () => {
    const cases: unknown[] = [
      null,
      [],
      { assets: [] },
      { version: "1", assets: [] },
      { version: 1 },
      {
        version: 1,
        assets: [{ id: "hero-model", kind: "model" }]
      }
    ];

    for (const input of cases) {
      assert.throws(
        () => AssetCatalog.parse(input),
        { name: "ZodError" }
      );
    }
  });

  test("rejects unsupported versions before reading assets", () => {
    assert.throws(
      () => AssetCatalog.parse({
        version: 2
      }),
      {
        name: "UnsupportedAssetManifestError",
        version: 2
      }
    );
    assert.throws(
      () => AssetCatalog.parse({
        version: 2,
        assets: []
      }),
      UnsupportedAssetManifestError
    );
  });

  test("rejects duplicate identifiers", () => {
    const catalog = new AssetCatalog([heroRecord()]);

    assert.throws(
      () => catalog.add(heroRecord()),
      (error: unknown) => {
        assert.ok(error instanceof AssetAlreadyExistsError);
        assert.equal(error.id.value, "hero-model");

        return true;
      }
    );
  });

  test("iterates over records in insertion order", () => {
    const first = heroRecord();
    const second = new AssetRecord({
      id: "theme-music",
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
    assert.deepEqual(
      Array.from(new AssetCatalog(catalog)),
      [first, second]
    );
  });

  test("validates the kind expected by a scene reference", () => {
    const catalog = new AssetCatalog([heroRecord()]);
    const reference = new AssetReference(
      "hero-model",
      new AssetType<unknown>("audio")
    );

    assert.throws(
      () => catalog.resolve(reference),
      (error: unknown) => {
        assert.ok(error instanceof AssetKindMismatchError);
        assert.equal(error.id.value, "hero-model");
        assert.equal(error.expectedKind, "audio");
        assert.equal(error.actualKind, "model");

        return true;
      }
    );
  });

  test("set inserts a new record or replaces the one with its ID", () => {
    const catalog = new AssetCatalog();
    const moved = heroRecord("project:/characters/hero.glb");

    catalog.set(heroRecord());
    catalog.set(moved);

    assert.equal(catalog.size, 1);
    assert.equal(catalog.get("hero-model"), moved);
  });

  test("find returns undefined where get throws", () => {
    const catalog = new AssetCatalog([heroRecord()]);

    assert.equal(catalog.find("hero-model")?.kind, "model");
    assert.equal(catalog.find("villain"), undefined);
    assert.throws(
      () => catalog.get("villain"),
      (error: unknown) => {
        assert.ok(error instanceof AssetNotFoundError);
        assert.equal(error.id.value, "villain");

        return true;
      }
    );
  });

  test("removes a record and returns it", () => {
    const record = heroRecord();
    const catalog = new AssetCatalog([record]);

    assert.equal(catalog.remove("hero-model"), record);
    assert.equal(catalog.has("hero-model"), false);
    assert.throws(
      () => catalog.get(record.id),
      AssetNotFoundError
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
});
