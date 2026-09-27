// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetAlreadyExistsError,
  AssetCatalog,
  AssetFetchError,
  AssetId,
  AssetKindMismatchError,
  AssetKindNotFoundError,
  AssetNotFoundError,
  AssetRecord,
  AssetReference,
  AssetType,
  CATALOG_URL_PATH,
  UnsupportedAssetManifestError
} from "../src/index.ts";
import {
  mockOrigin,
  MOCK_ORIGIN
} from "./helpers/mockOrigin.ts";

// CONSTANTS
const kCatalogUrl = `${MOCK_ORIGIN}${CATALOG_URL_PATH}`;
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

  test("rejects malformed manifests with a TypeError", () => {
    const cases: Array<[unknown, RegExp]> = [
      [null, /manifest must be an object/],
      [[], /manifest must be an object/],
      [{ assets: [] }, /version must be a number/],
      [{ version: "1", assets: [] }, /version must be a number/],
      [{ version: 1 }, /assets must be an array/],
      [
        {
          version: 1,
          assets: [{ id: "hero-model", kind: "model" }]
        },
        /source must be a string/
      ]
    ];

    for (const [input, message] of cases) {
      assert.throws(
        () => AssetCatalog.parse(input),
        {
          name: "TypeError",
          message
        }
      );
    }
  });

  test("rejects unsupported manifest versions", () => {
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
      AssetAlreadyExistsError
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
      AssetKindMismatchError
    );
  });

  test("updates a source without changing its stable identifier", () => {
    const catalog = new AssetCatalog([heroRecord()]);

    catalog.replace(heroRecord("project:/characters/hero.glb"));

    assert.equal(
      catalog.get(new AssetId("hero-model")).source,
      "project:/characters/hero.glb"
    );
  });

  test("removes a record and returns it", () => {
    const record = heroRecord();
    const catalog = new AssetCatalog([record]);

    assert.equal(catalog.remove(record.id), record);
    assert.equal(catalog.has(record.id), false);
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
          "The catalog holds no \"texture\" asset."
        );
        assert.equal(error.kind, "texture");

        return true;
      }
    );
  });
});

describe("AssetCatalog.fetch", () => {
  const origin = mockOrigin();

  test("parses the manifest served by the catalog endpoint", async() => {
    origin.intercept(CATALOG_URL_PATH).reply(200, kManifest);

    const catalog = await AssetCatalog.fetch(kCatalogUrl);

    assert.deepEqual(catalog.toJSON(), kManifest);
  });

  test("requests CATALOG_URL_PATH when no url is given", async(t) => {
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      async() => Response.json(kManifest)
    );

    await AssetCatalog.fetch();

    assert.deepEqual(
      fetchMock.mock.calls.map((call) => call.arguments),
      [[CATALOG_URL_PATH]]
    );
  });

  test("throws AssetFetchError on a non-2xx status", async() => {
    origin.intercept(CATALOG_URL_PATH).reply(404, "");

    await assert.rejects(
      () => AssetCatalog.fetch(kCatalogUrl),
      (error: AssetFetchError) => {
        assert.ok(error instanceof AssetFetchError);
        assert.equal(
          error.message,
          `Request to "${kCatalogUrl}" responded with 404.`
        );
        assert.equal(error.status, 404);
        assert.equal(error.url, kCatalogUrl);
        assert.equal(error.record, null);

        return true;
      }
    );
  });

  test("propagates JSON-decoding errors", async() => {
    origin.intercept(CATALOG_URL_PATH).reply(200, "not json", {
      headers: {
        "content-type": "application/json"
      }
    });

    await assert.rejects(
      () => AssetCatalog.fetch(kCatalogUrl),
      SyntaxError
    );
  });

  test("propagates manifest validation errors", async() => {
    origin.intercept(CATALOG_URL_PATH).reply(200, {
      version: 1
    });

    await assert.rejects(
      () => AssetCatalog.fetch(kCatalogUrl),
      {
        name: "TypeError",
        message: "Asset manifest assets must be an array."
      }
    );
  });

  test("propagates transport failures", async() => {
    origin
      .intercept(CATALOG_URL_PATH)
      .replyWithError(new Error("socket hang up"));

    await assert.rejects(
      () => AssetCatalog.fetch(kCatalogUrl),
      {
        name: "TypeError",
        message: "fetch failed"
      }
    );
  });
});
