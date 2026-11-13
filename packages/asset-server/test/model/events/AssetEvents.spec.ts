// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { sha256Hex } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  describeRejection,
  parseAssetEvent,
  writeData
} from "#src/index.ts";
import { bytes } from "../../helpers/bytes.ts";
import { assetEvent } from "../../helpers/events.ts";

// CONSTANTS
const kWriteData = {
  path: "a.png",
  kind: "binary",
  hash: "h1",
  size: 5,
  content: { type: "inline", data: bytes("hello") }
};
const kRenamedData = {
  from: "a.png",
  to: "b.png",
  kind: "binary",
  hash: "h1"
};
const kDeletedData = {
  path: "a.png",
  kind: "binary"
};

function readRejection(
  eventType: string,
  eventData: unknown
) {
  const parsed = parseAssetEvent(assetEvent(eventType, eventData));
  assert.strictEqual(parsed.ok, false);

  return parsed.val;
}

describe("parseAssetEvent", () => {
  test("returns the parsed payload for each lifecycle type", () => {
    for (const eventType of [ASSET_CREATED, ASSET_UPDATED]) {
      const parsed = parseAssetEvent(assetEvent(eventType, kWriteData));

      assert.ok(parsed.ok);
      assert.strictEqual(parsed.val.eventType, eventType);
      assert.deepStrictEqual(parsed.val.eventData, kWriteData);
    }

    const renamed = parseAssetEvent(assetEvent(ASSET_RENAMED, kRenamedData));
    assert.ok(renamed.ok);
    assert.deepStrictEqual(renamed.val.eventData, kRenamedData);

    const deleted = parseAssetEvent(assetEvent(ASSET_DELETED, kDeletedData));
    assert.ok(deleted.ok);
    assert.deepStrictEqual(deleted.val.eventData, kDeletedData);
  });

  test("does not mutate the stored payload", () => {
    const eventData = { ...kWriteData };
    const parsed = parseAssetEvent(assetEvent(ASSET_CREATED, eventData));

    assert.ok(parsed.ok);
    assert.deepStrictEqual(eventData, kWriteData);
  });

  test("keeps unknown payload fields", () => {
    const parsed = parseAssetEvent(assetEvent(ASSET_DELETED, {
      ...kDeletedData,
      addedByANewerWriter: true
    }));

    assert.ok(parsed.ok);
    assert.deepStrictEqual(parsed.val.eventData, {
      ...kDeletedData,
      addedByANewerWriter: true
    });
  });

  test("rejects a reference content payload as unsupported", () => {
    const rejection = readRejection(ASSET_CREATED, {
      ...kWriteData,
      content: {
        type: "ref",
        hash: "h1",
        size: 5
      }
    });

    assert.strictEqual(rejection.reason, "unsupported");
    assert.strictEqual(
      describeRejection(rejection),
      "content references are not supported yet"
    );
  });

  test("rejects a payload belonging to another lifecycle type", () => {
    assert.strictEqual(
      readRejection(ASSET_CREATED, kRenamedData).reason,
      "malformed"
    );
    assert.strictEqual(
      readRejection(ASSET_RENAMED, kWriteData).reason,
      "malformed"
    );
  });

  test("rejects a write payload missing a field", () => {
    for (const field of ["path", "kind", "hash", "size", "content"]) {
      const eventData: Record<string, unknown> = { ...kWriteData };
      delete eventData[field];

      assert.strictEqual(
        readRejection(ASSET_CREATED, eventData).reason,
        "malformed",
        `expected a missing "${field}" to be rejected`
      );
    }
  });

  test("reports the offending field of a mistyped payload", () => {
    const rejection = readRejection(ASSET_CREATED, {
      ...kWriteData,
      size: "5"
    });

    assert.strictEqual(rejection.reason, "malformed");
    assert.match(describeRejection(rejection), /\/size/);
  });

  test("rejects malformed inline content", () => {
    assert.strictEqual(
      readRejection(ASSET_CREATED, {
        ...kWriteData,
        content: {
          type: "inline",
          encoding: "utf8",
          data: "hello"
        }
      }).reason,
      "malformed"
    );
  });

  test("rejects a non-object payload", () => {
    for (const eventData of [null, undefined, "a.png", 42]) {
      assert.strictEqual(
        readRejection(ASSET_CREATED, eventData).reason,
        "malformed"
      );
    }
  });

  test("reports a domain event on an asset stream as foreign", () => {
    const rejection = readRejection("counter.incremented", {});

    assert.strictEqual(rejection.reason, "foreign");
    assert.strictEqual(
      describeRejection(rejection),
      "event belongs to another domain"
    );
  });
});

describe("legacy base64 content", () => {
  test("a stored base64 write event parses to bytes, parts included", () => {
    const parsed = parseAssetEvent(assetEvent(ASSET_UPDATED, {
      ...kWriteData,
      content: {
        type: "inline",
        encoding: "base64",
        data: "+vv8/Q=="
      },
      parts: {
        a: {
          hash: "h2",
          size: 2,
          content: {
            type: "inline",
            encoding: "base64",
            data: "AAE="
          }
        },
        b: {
          hash: "h3",
          size: 1,
          at: 1
        }
      }
    }));

    assert.ok(parsed.ok);
    assert.deepStrictEqual(parsed.val.eventData, {
      ...kWriteData,
      content: {
        type: "inline",
        data: Uint8Array.from([250, 251, 252, 253])
      },
      parts: {
        a: {
          hash: "h2",
          size: 2,
          content: {
            type: "inline",
            data: Uint8Array.from([0, 1])
          }
        },
        b: {
          hash: "h3",
          size: 1,
          at: 1
        }
      }
    });
  });

  test("stored base64 that does not decode is malformed", () => {
    const rejection = readRejection(ASSET_UPDATED, {
      ...kWriteData,
      content: {
        type: "inline",
        encoding: "base64",
        data: "not base64"
      }
    });

    assert.strictEqual(rejection.reason, "malformed");
  });
});

describe("writeData", () => {
  test("snapshots bytes and references before hashing", async() => {
    const data = Buffer.from([0, 1, 2, 3]);
    const dependencies = [{ id: "original", kind: "binary" }];
    const pending = writeData(
      "a.bin",
      "binary",
      data.subarray(1, 3),
      dependencies
    );
    data.fill(9);
    dependencies[0].id = "changed";
    dependencies.push({ id: "added", kind: "binary" });

    const result = await pending;

    assert.deepEqual(result.content.data, new Uint8Array([1, 2]));
    assert.equal(result.size, 2);
    assert.equal(result.hash, await sha256Hex(new Uint8Array([1, 2])));
    assert.deepEqual(result.dependencies, [{ id: "original", kind: "binary" }]);
  });
});
