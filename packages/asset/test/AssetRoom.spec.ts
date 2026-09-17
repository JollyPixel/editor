// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  AssetId,
  AssetRoom
} from "../src/index.ts";

describe("AssetRoom", () => {
  describe("constructor", () => {
    test("wraps a string asset id", () => {
      const room = new AssetRoom("pixelart", "a1");

      assert.strictEqual(room.kind, "pixelart");
      assert.ok(room.assetId instanceof AssetId);
      assert.strictEqual(room.assetId.value, "a1");
    });

    test("keeps an existing AssetId", () => {
      const assetId = new AssetId("a1");

      assert.strictEqual(new AssetRoom("pixelart", assetId).assetId, assetId);
    });

    test("rejects an empty kind or a kind with a colon", () => {
      assert.throws(() => new AssetRoom("", "a1"), TypeError);
      assert.throws(() => new AssetRoom("pixel:art", "a1"), TypeError);
    });

    test("rejects a blank asset id", () => {
      assert.throws(() => new AssetRoom("pixelart", " "), TypeError);
    });
  });

  describe("parse", () => {
    test("splits kind from asset id", () => {
      const room = AssetRoom.parse("pixelart:a1");

      assert.strictEqual(room?.kind, "pixelart");
      assert.strictEqual(room?.assetId.value, "a1");
    });

    test("only the first colon separates", () => {
      assert.strictEqual(AssetRoom.parse("pixelart:a:1")?.assetId.value, "a:1");
    });

    test("returns null for a missing separator or an empty half", () => {
      assert.strictEqual(AssetRoom.parse("pixelart"), null);
      assert.strictEqual(AssetRoom.parse(":a1"), null);
      assert.strictEqual(AssetRoom.parse("pixelart:"), null);
      assert.strictEqual(AssetRoom.parse("pixelart: "), null);
    });

    test("is the inverse of toString", () => {
      const room = new AssetRoom("pixelart", "a:1");

      assert.ok(AssetRoom.parse(room.toString())?.equals(room));
    });
  });

  describe("equals", () => {
    test("compares kind and asset id", () => {
      const room = new AssetRoom("pixelart", "a1");

      assert.ok(room.equals(new AssetRoom("pixelart", "a1")));
      assert.ok(!room.equals(new AssetRoom("voxelmap", "a1")));
      assert.ok(!room.equals(new AssetRoom("pixelart", "a2")));
    });
  });

  describe("serialization", () => {
    test("formats as kind:assetId", () => {
      const room = new AssetRoom("pixelart", "a1");

      assert.strictEqual(room.toString(), "pixelart:a1");
      assert.strictEqual(`${room}`, "pixelart:a1");
      assert.strictEqual(JSON.stringify({ room }), "{\"room\":\"pixelart:a1\"}");
    });
  });
});
