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
  AssetFetchError,
  AssetRecord
} from "../src/index.ts";

// CONSTANTS
const kOrigin = "http://localhost";

function recordOf(
  source: string
): AssetRecord {
  return new AssetRecord({
    id: "world",
    kind: "voxelmap",
    source
  });
}

describe("AssetRecord.sourceUrl", () => {
  test("prefixes and encodes the record source", () => {
    assert.equal(
      recordOf("maps/my world.voxelmap").sourceUrl(),
      "/assets/maps/my%20world.voxelmap"
    );
  });

  test("honours a custom prefix", () => {
    assert.equal(
      recordOf("a.png").sourceUrl("/static"),
      "/static/a.png"
    );
  });
});

describe("AssetRecord.fetch", () => {
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

  test("resolves the response served by the record source URL", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: "/assets/maps/world.voxelmap",
        method: "GET"
      })
      .reply(200, "world-bytes");

    const response = await recordOf("maps/world.voxelmap").fetch({
      prefix: `${kOrigin}/assets/`
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "world-bytes");
  });

  test("forwards RequestInit members to fetch", async() => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async(input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(input), init]);

      return new Response("ok");
    };

    try {
      await recordOf("maps/world.voxelmap").fetch({
        headers: {
          "x-test": "1"
        }
      });

      assert.equal(calls.length, 1);
      const [url, init] = calls[0];
      assert.equal(url, "/assets/maps/world.voxelmap");
      assert.deepEqual(init, {
        headers: {
          "x-test": "1"
        }
      });
    }
    finally {
      globalThis.fetch = previousFetch;
    }
  });

  test("throws AssetFetchError on a non-2xx status", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: "/assets/maps/world.voxelmap",
        method: "GET"
      })
      .reply(404, "");

    const record = recordOf("maps/world.voxelmap");
    const url = `${kOrigin}/assets/maps/world.voxelmap`;

    await assert.rejects(
      () => record.fetch({ prefix: `${kOrigin}/assets/` }),
      (error: AssetFetchError) => {
        assert.ok(error instanceof AssetFetchError);
        assert.equal(error.name, "AssetFetchError");
        assert.equal(
          error.message,
          `Request to "${url}" responded with 404.`
        );
        assert.equal(error.status, 404);
        assert.equal(error.url, url);
        assert.equal(error.record, record);

        return true;
      }
    );
  });

  test("surfaces transport failures", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: "/assets/maps/world.voxelmap",
        method: "GET"
      })
      .replyWithError(new Error("socket hang up"));

    await assert.rejects(
      () => recordOf("maps/world.voxelmap").fetch({
        prefix: `${kOrigin}/assets/`
      }),
      {
        name: "TypeError",
        message: "fetch failed"
      }
    );
  });
});

describe("AssetRecord.text", () => {
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

  test("reads the response body as text", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: "/assets/maps/world.voxelmap",
        method: "GET"
      })
      .reply(200, "{\"version\":1}");

    const source = await recordOf("maps/world.voxelmap").text({
      prefix: `${kOrigin}/assets/`
    });

    assert.equal(source, "{\"version\":1}");
  });

  test("propagates AssetFetchError", async() => {
    agent
      .get(kOrigin)
      .intercept({
        path: "/assets/maps/world.voxelmap",
        method: "GET"
      })
      .reply(500, "");

    await assert.rejects(
      () => recordOf("maps/world.voxelmap").text({
        prefix: `${kOrigin}/assets/`
      }),
      AssetFetchError
    );
  });
});
