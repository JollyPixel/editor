// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetFetchError,
  AssetRecord,
  type AssetRecordOptions
} from "../src/index.ts";
import {
  mockOrigin,
  MOCK_ORIGIN
} from "./helpers/mockOrigin.ts";

// CONSTANTS
const kPrefix = `${MOCK_ORIGIN}/assets/`;
const kWorldPath = "/assets/maps/world.voxelmap";
const kWorldOptions: AssetRecordOptions = {
  id: "world",
  kind: "voxelmap",
  source: "maps/world.voxelmap"
};

function worldRecord(): AssetRecord {
  return new AssetRecord(kWorldOptions);
}

describe("AssetRecord", () => {
  test("rejects blank kind, source, or provided revision", () => {
    const cases: Array<[Partial<AssetRecordOptions>, RegExp]> = [
      [{ kind: " " }, /kind must not be empty/],
      [{ source: "" }, /source must not be empty/],
      [{ revision: "" }, /revision must not be empty/]
    ];

    for (const [override, message] of cases) {
      assert.throws(
        () => new AssetRecord({
          ...kWorldOptions,
          ...override
        }),
        {
          name: "TypeError",
          message
        }
      );
    }
  });

  test("serializes revision only when it is set", () => {
    assert.deepEqual(worldRecord().toJSON(), {
      id: "world",
      kind: "voxelmap",
      source: "maps/world.voxelmap"
    });
    assert.deepEqual(
      new AssetRecord({
        ...kWorldOptions,
        revision: "sha256:abc"
      }).toJSON(),
      {
        id: "world",
        kind: "voxelmap",
        source: "maps/world.voxelmap",
        revision: "sha256:abc"
      }
    );
  });

  test("parses a record with an explicitly undefined revision", () => {
    const record = AssetRecord.parse({
      ...kWorldOptions,
      revision: undefined
    });

    assert.equal(record.id.value, "world");
    assert.equal(record.revision, undefined);
  });

  test("rejects malformed persisted records with a TypeError", () => {
    const cases: Array<[unknown, RegExp]> = [
      [null, /record must be an object/],
      [[], /record must be an object/],
      [{ kind: "voxelmap", source: "a" }, /ID must be a string/],
      [{ id: "world", kind: 1, source: "a" }, /kind must be a string/],
      [{ id: "world", kind: "voxelmap" }, /source must be a string/],
      [
        {
          ...kWorldOptions,
          revision: 1
        },
        /revision must be a string/
      ]
    ];

    for (const [input, message] of cases) {
      assert.throws(
        () => AssetRecord.parse(input),
        {
          name: "TypeError",
          message
        }
      );
    }
  });
});

describe("AssetRecord.fetch", () => {
  const origin = mockOrigin();

  test("resolves the response served by the record source URL", async() => {
    origin.intercept(kWorldPath).reply(200, "world-bytes");

    const response = await worldRecord().fetch({
      prefix: kPrefix
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "world-bytes");
  });

  test("forwards every option except prefix to fetch", async(t) => {
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      async() => new Response("ok")
    );

    await worldRecord().fetch({
      prefix: "/static",
      headers: {
        "x-test": "1"
      }
    });

    assert.deepEqual(
      fetchMock.mock.calls.map((call) => call.arguments),
      [[
        "/static/maps/world.voxelmap",
        {
          headers: {
            "x-test": "1"
          }
        }
      ]]
    );
  });

  test("throws AssetFetchError on a non-2xx status", async() => {
    origin.intercept(kWorldPath).reply(404, "");

    const record = worldRecord();
    const url = `${MOCK_ORIGIN}${kWorldPath}`;

    await assert.rejects(
      () => record.fetch({ prefix: kPrefix }),
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

  test("propagates transport failures", async() => {
    origin
      .intercept(kWorldPath)
      .replyWithError(new Error("socket hang up"));

    await assert.rejects(
      () => worldRecord().fetch({ prefix: kPrefix }),
      {
        name: "TypeError",
        message: "fetch failed"
      }
    );
  });
});

describe("AssetRecord.text", () => {
  const origin = mockOrigin();

  test("reads the response body as text", async() => {
    origin.intercept(kWorldPath).reply(200, "{\"version\":1}");

    const source = await worldRecord().text({
      prefix: kPrefix
    });

    assert.equal(source, "{\"version\":1}");
  });

  test("propagates AssetFetchError", async() => {
    origin.intercept(kWorldPath).reply(500, "");

    await assert.rejects(
      () => worldRecord().text({ prefix: kPrefix }),
      AssetFetchError
    );
  });
});
