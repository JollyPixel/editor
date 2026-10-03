// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_PLAN
} from "#src/index.ts";
import { catalogMessageProtocol } from "#src/catalog/protocol.schema.ts";

function accepts(
  message: unknown
): boolean {
  return MessageParser.of(catalogMessageProtocol).parse(message).ok;
}

describe("catalogMessageProtocol", () => {
  test("accepts a deletion change with a null record", () => {
    assert.strictEqual(accepts({
      type: CATALOG_CHANGED,
      change: {
        eventType: "asset.deleted",
        assetId: "a1",
        record: null
      }
    }), true);
  });

  test("refuses a change whose record has no source", () => {
    assert.strictEqual(accepts({
      type: CATALOG_CHANGED,
      change: {
        eventType: "asset.created",
        assetId: "a1",
        record: {
          id: "a1",
          kind: "binary"
        }
      }
    }), false);
  });

  test("checks each applied reply against its command", () => {
    assert.strictEqual(accepts({
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_CREATE,
      assetId: "a1"
    }), true);
    assert.strictEqual(accepts({
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_CREATE,
      path: "a.png"
    }), false);
    assert.strictEqual(accepts({
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_PLAN,
      plan: { live: [] }
    }), false);
  });
});
