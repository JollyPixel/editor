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
  CATALOG_DELETE,
  CATALOG_PLAN,
  CATALOG_RENAME,
  CATALOG_RESTORE,
  CATALOG_TAG,
  CATALOG_UNTAG
} from "#src/index.ts";
import {
  catalogCommandProtocol,
  catalogMessageProtocol
} from "#src/catalog/protocol.schema.ts";

function accepts(
  message: unknown
): boolean {
  return MessageParser.of(catalogMessageProtocol).parse(message).ok;
}

function parses(
  command: unknown
): boolean {
  return MessageParser.of(catalogCommandProtocol).parse(command).ok;
}

describe("catalogCommandProtocol", () => {
  test("takes a non-empty list for rename and delete", () => {
    assert.strictEqual(parses({
      type: CATALOG_RENAME,
      requestId: "r1",
      renames: [{ assetId: "a1", to: "b.png" }]
    }), true);
    assert.strictEqual(parses({
      type: CATALOG_DELETE,
      requestId: "r2",
      assetIds: ["a1"],
      force: true
    }), true);
    assert.strictEqual(parses({
      type: CATALOG_DELETE,
      requestId: "r3",
      assetIds: []
    }), false);
    assert.strictEqual(parses({
      type: CATALOG_RENAME,
      requestId: "r4",
      assetId: "a1",
      to: "b.png"
    }), false);
    assert.strictEqual(parses({
      type: CATALOG_DELETE,
      requestId: "r5",
      assetId: "a1"
    }), false);
  });

  test("limits tag names and messages", () => {
    const cases = [
      { type: CATALOG_TAG, name: "v1.0_final-2", valid: true },
      { type: CATALOG_TAG, name: "x".repeat(64), valid: true },
      { type: CATALOG_TAG, name: "x".repeat(65), valid: false },
      { type: CATALOG_TAG, name: "", valid: false },
      { type: CATALOG_TAG, name: "-draft", valid: false },
      { type: CATALOG_TAG, name: "restore/12", valid: false },
      { type: CATALOG_UNTAG, name: "restore/12", valid: true },
      { type: CATALOG_RESTORE, name: "restore/12", valid: true },
      { type: CATALOG_RESTORE, name: "", valid: false },
      { type: CATALOG_UNTAG, name: "x".repeat(65), valid: false }
    ];
    for (const { type, name, valid } of cases) {
      assert.strictEqual(parses({
        type,
        requestId: "r1",
        assetId: "a1",
        name
      }), valid, `${type} "${name}"`);
    }

    assert.strictEqual(parses({
      type: CATALOG_TAG,
      requestId: "r1",
      assetId: "a1",
      name: "v1",
      message: "x".repeat(4_096)
    }), true);
    assert.strictEqual(parses({
      type: CATALOG_TAG,
      requestId: "r1",
      assetId: "a1",
      name: "v1",
      message: "x".repeat(4_097)
    }), false);
  });
});

describe("catalogMessageProtocol", () => {
  test("accepts a deletion change with a null record", () => {
    assert.strictEqual(accepts({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.deleted",
        assetId: "a1",
        record: null
      }]
    }), true);
  });

  test("refuses a change whose record has no source", () => {
    assert.strictEqual(accepts({
      type: CATALOG_CHANGED,
      changes: [{
        eventType: "asset.created",
        assetId: "a1",
        record: {
          id: "a1",
          kind: "binary"
        }
      }]
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
    assert.strictEqual(accepts({
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_DELETE,
      applied: 0,
      failure: "refused"
    }), true);
    assert.strictEqual(accepts({
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_RENAME,
      assetId: "a1"
    }), false);
  });
});
