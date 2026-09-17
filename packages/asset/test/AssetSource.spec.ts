// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetSource } from "../src/index.ts";

function partsOf(
  source: AssetSource
) {
  return {
    directory: source.directory,
    name: source.name,
    extension: source.extension
  };
}

describe("AssetSource", () => {
  describe("constructor", () => {
    test("splits at the last slash and the first dot of the file name", () => {
      assert.deepEqual(partsOf(new AssetSource("maps/world.voxelmap.json")), {
        directory: "maps/",
        name: "world",
        extension: ".voxelmap.json"
      });
    });

    test("keeps a leading dot in the name", () => {
      assert.deepEqual(partsOf(new AssetSource(".hidden")), {
        directory: "",
        name: ".hidden",
        extension: ""
      });
    });

    test("ignores dots in the directory", () => {
      assert.deepEqual(partsOf(new AssetSource("v1.2/readme")), {
        directory: "v1.2/",
        name: "readme",
        extension: ""
      });
    });
  });

  describe("from", () => {
    test("wraps a string", () => {
      const source = AssetSource.from("textures/block.pixelart");

      assert.ok(source instanceof AssetSource);
      assert.strictEqual(source.toString(), "textures/block.pixelart");
    });

    test("returns an existing instance unchanged", () => {
      const source = new AssetSource("textures/block.pixelart");

      assert.strictEqual(AssetSource.from(source), source);
    });
  });

  describe("withName", () => {
    test("keeps the directory and the extension", () => {
      const source = new AssetSource("textures/block.pixelart");
      const renamed = source.withName("stone");

      assert.strictEqual(renamed.toString(), "textures/stone.pixelart");
      assert.strictEqual(source.toString(), "textures/block.pixelart");
    });
  });

  describe("equals", () => {
    test("compares the full source", () => {
      const source = new AssetSource("maps/world.voxelmap.json");

      assert.ok(source.equals(new AssetSource("maps/world.voxelmap.json")));
      assert.ok(!source.equals(new AssetSource("maps/world.json")));
    });
  });

  describe("serialization", () => {
    test("round-trips through toString and JSON", () => {
      const source = new AssetSource("maps/world.voxelmap.json");

      assert.strictEqual(String(source), "maps/world.voxelmap.json");
      assert.strictEqual(
        JSON.stringify({ source }),
        "{\"source\":\"maps/world.voxelmap.json\"}"
      );
    });
  });
});
