// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  describeRejection,
  encodeContent,
  parseAssetEvent
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { assetEvent } from "../helpers/events.ts";

// CONSTANTS
const kWriteData = {
  path: "a.png",
  kind: "binary",
  hash: "h1",
  size: 5,
  content: encodeContent(bytes("hello"))
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

function rejectionOf(
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
    const rejection = rejectionOf(ASSET_CREATED, {
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
      rejectionOf(ASSET_CREATED, kRenamedData).reason,
      "malformed"
    );
    assert.strictEqual(
      rejectionOf(ASSET_RENAMED, kWriteData).reason,
      "malformed"
    );
  });

  test("rejects a write payload missing a field", () => {
    for (const field of ["path", "kind", "hash", "size", "content"]) {
      const eventData: Record<string, unknown> = { ...kWriteData };
      delete eventData[field];

      assert.strictEqual(
        rejectionOf(ASSET_CREATED, eventData).reason,
        "malformed",
        `expected a missing "${field}" to be rejected`
      );
    }
  });

  test("reports the offending field of a mistyped payload", () => {
    const rejection = rejectionOf(ASSET_CREATED, {
      ...kWriteData,
      size: "5"
    });

    assert.strictEqual(rejection.reason, "malformed");
    assert.match(describeRejection(rejection), /\/size/);
  });

  test("rejects malformed inline content", () => {
    assert.strictEqual(
      rejectionOf(ASSET_CREATED, {
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
        rejectionOf(ASSET_CREATED, eventData).reason,
        "malformed"
      );
    }
  });

  test("reports a domain event on an asset stream as foreign", () => {
    const rejection = rejectionOf("counter.incremented", {});

    assert.strictEqual(rejection.reason, "foreign");
    assert.strictEqual(
      describeRejection(rejection),
      "event belongs to another domain"
    );
  });
});
