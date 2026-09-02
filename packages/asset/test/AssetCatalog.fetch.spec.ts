// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  after,
  before,
  beforeEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  getGlobalDispatcher,
  setGlobalDispatcher,
  Dispatcher,
  MockAgent
} from "undici";

// Import Internal Dependencies
import {
  AssetCatalog,
  AssetFetchError,
  AssetId,
  UnsupportedAssetManifestError
} from "../src/index.ts";
import { CATALOG_URL_PATH } from "../src/urls.ts";

// CONSTANTS
const kOrigin = "http://localhost";
const kCatalogUrl = `${kOrigin}${CATALOG_URL_PATH}`;
const kManifest = {
  version: 1,
  assets: [
    {
      id: "hero-model",
      kind: "model",
      source: "project:/models/hero.glb",
      revision: "sha256:abc"
    }
  ]
};

describe("AssetCatalog.fetch", () => {
  let originalDispatcher: Dispatcher;
  let agent: MockAgent;

  before(() => {
    originalDispatcher = getGlobalDispatcher();
  });

  after(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  beforeEach(async() => {
    if (agent) {
      await agent.close();
    }
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  test("parses the manifest served by the catalog endpoint", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
      .reply(200, kManifest);

    const catalog = await AssetCatalog.fetch(kCatalogUrl);
    const record = catalog.get(
      new AssetId("hero-model")
    );

    assert.equal(catalog.size, 1);
    assert.equal(record.kind, "model");
    assert.equal(record.source, "project:/models/hero.glb");
    assert.equal(record.revision, "sha256:abc");
  });

  test("requests CATALOG_URL_PATH when no url is given", async() => {
    const calls: Array<string> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async(input: RequestInfo | URL) => {
      calls.push(String(input));

      return Response.json(kManifest);
    };

    try {
      const catalog = await AssetCatalog.fetch();

      assert.deepEqual(calls, [CATALOG_URL_PATH]);
      assert.equal(catalog.size, 1);
    }
    finally {
      globalThis.fetch = previousFetch;
    }
  });

  test("throws AssetFetchError on a non-2xx status", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
      .reply(404, "");

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

  test("throws when the response body is not JSON", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
      .reply(200, "not json", {
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
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
      .reply(200, {
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

  test("propagates unsupported manifest versions", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
      .reply(200, {
        version: 2,
        assets: []
      });

    await assert.rejects(
      () => AssetCatalog.fetch(kCatalogUrl),
      UnsupportedAssetManifestError
    );
  });

  test("surfaces transport failures", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: CATALOG_URL_PATH,
        method: "GET"
      })
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
