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
  encodeContent,
  isAssetEvent
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

describe("isAssetEvent", () => {
  test("accepts each lifecycle type with its own payload", () => {
    for (const eventType of [ASSET_CREATED, ASSET_UPDATED]) {
      assert.ok(isAssetEvent(assetEvent(eventType, kWriteData)));
    }

    assert.ok(isAssetEvent(assetEvent(ASSET_RENAMED, kRenamedData)));
    assert.ok(isAssetEvent(assetEvent(ASSET_DELETED, kDeletedData)));
  });

  test("accepts a reference content payload", () => {
    assert.ok(isAssetEvent(assetEvent(ASSET_CREATED, {
      ...kWriteData,
      content: {
        type: "ref",
        hash: "h1",
        size: 5
      }
    })));
  });

  test("rejects a payload belonging to another lifecycle type", () => {
    assert.strictEqual(
      isAssetEvent(assetEvent(ASSET_CREATED, kRenamedData)),
      false
    );
    assert.strictEqual(
      isAssetEvent(assetEvent(ASSET_RENAMED, kWriteData)),
      false
    );
  });

  test("rejects a write payload missing a field", () => {
    for (const field of ["path", "kind", "hash", "size", "content"]) {
      const eventData: Record<string, unknown> = { ...kWriteData };
      delete eventData[field];

      assert.strictEqual(
        isAssetEvent(assetEvent(ASSET_CREATED, eventData)),
        false,
        `expected a missing "${field}" to be rejected`
      );
    }
  });

  test("rejects a write payload with a mistyped field", () => {
    assert.strictEqual(
      isAssetEvent(assetEvent(ASSET_CREATED, {
        ...kWriteData,
        size: "5"
      })),
      false
    );
  });

  test("rejects malformed inline content", () => {
    assert.strictEqual(
      isAssetEvent(assetEvent(ASSET_CREATED, {
        ...kWriteData,
        content: {
          type: "inline",
          encoding: "utf8",
          data: "hello"
        }
      })),
      false
    );
  });

  test("rejects a non-object payload", () => {
    for (const eventData of [null, undefined, "a.png", 42]) {
      assert.strictEqual(
        isAssetEvent(assetEvent(ASSET_CREATED, eventData)),
        false
      );
    }
  });

  test("rejects domain events on an asset stream", () => {
    assert.strictEqual(
      isAssetEvent(assetEvent("counter.incremented", {})),
      false
    );
  });
});
