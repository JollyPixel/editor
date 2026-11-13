// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetRoom } from "../src/index.ts";

describe("AssetRoom", () => {
  describe("parse", () => {
    test("splits kind from asset id", () => {
      const room = AssetRoom.parse("pixelart:a1");

      assert.strictEqual(room?.kind.value, "pixelart");
      assert.strictEqual(room?.assetId.value, "a1");
    });

    test("returns null for a missing separator or an empty half", () => {
      assert.strictEqual(AssetRoom.parse("pixelart"), null);
      assert.strictEqual(AssetRoom.parse(":a1"), null);
      assert.strictEqual(AssetRoom.parse(" :a1"), null);
      assert.strictEqual(AssetRoom.parse("pixelart:"), null);
      assert.strictEqual(AssetRoom.parse("pixelart: "), null);
    });

    test("is the inverse of toString when the asset id has a colon", () => {
      const room = new AssetRoom("pixelart", "a:1");

      assert.ok(AssetRoom.parse(room.toString())?.equals(room));
    });

    test("reads a tag between the kind and the asset id", () => {
      const room = AssetRoom.parse("pixelart@restore/3:a@1");

      assert.strictEqual(room?.kind.value, "pixelart");
      assert.strictEqual(room?.tag, "restore/3");
      assert.strictEqual(room?.assetId.value, "a@1");
      assert.strictEqual(AssetRoom.parse("pixelart:a1")?.tag, null);
    });

    test("returns null for an empty tag", () => {
      assert.strictEqual(AssetRoom.parse("pixelart@:a1"), null);
    });
  });

  describe("tag", () => {
    test("a tagged room is a different room of the same asset", () => {
      const tagged = new AssetRoom("pixelart", "a1", "v1");

      assert.strictEqual(tagged.toString(), "pixelart@v1:a1");
      assert.ok(!tagged.equals(new AssetRoom("pixelart", "a1")));
      assert.ok(AssetRoom.parse(tagged.toString())?.equals(tagged));
    });

    test("rejects a tag with a colon", () => {
      assert.throws(() => new AssetRoom("pixelart", "a1", "v:1"), TypeError);
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
