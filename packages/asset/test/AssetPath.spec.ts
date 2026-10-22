// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetPath } from "../src/index.ts";

function readParts(
  path: AssetPath
) {
  return {
    directory: path.directory,
    name: path.name,
    extension: path.extension
  };
}

describe("AssetPath", () => {
  describe("constructor", () => {
    test("rejects a blank path", () => {
      assert.throws(() => new AssetPath(" "), {
        name: "TypeError",
        message: /path must not be empty/
      });
    });

    test("splits at the last slash and the first dot of the file name", () => {
      assert.deepEqual(readParts(new AssetPath("maps/world.voxelmap.json")), {
        directory: "maps/",
        name: "world",
        extension: ".voxelmap.json"
      });
    });

    test("keeps a leading dot in the name", () => {
      assert.deepEqual(readParts(new AssetPath(".hidden")), {
        directory: "",
        name: ".hidden",
        extension: ""
      });
    });

    test("ignores dots in the directory", () => {
      assert.deepEqual(readParts(new AssetPath("v1.2/readme")), {
        directory: "v1.2/",
        name: "readme",
        extension: ""
      });
    });
  });

  describe("from", () => {
    test("wraps a string", () => {
      const path = AssetPath.from("textures/block.pixelart");

      assert.ok(path instanceof AssetPath);
      assert.strictEqual(path.toString(), "textures/block.pixelart");
    });

    test("returns an existing instance unchanged", () => {
      const path = new AssetPath("textures/block.pixelart");

      assert.strictEqual(AssetPath.from(path), path);
    });
  });

  describe("withName", () => {
    test("keeps the directory and the extension", () => {
      const path = new AssetPath("textures/block.pixelart");
      const renamed = path.withName("stone");

      assert.strictEqual(renamed.toString(), "textures/stone.pixelart");
      assert.strictEqual(path.toString(), "textures/block.pixelart");
    });
  });

  describe("withExtension", () => {
    test("keeps the directory and the name", () => {
      const path = new AssetPath("textures/block.pixelart");

      assert.strictEqual(
        path.withExtension(".png").toString(),
        "textures/block.png"
      );
      assert.strictEqual(path.withoutExtension().toString(), "textures/block");
    });

    test("rejects an extension without a leading dot", () => {
      assert.throws(
        () => new AssetPath("textures/block.pixelart").withExtension("png"),
        {
          name: "TypeError",
          message: /extension must be empty or start with "\."/
        }
      );
    });
  });

  describe("equals", () => {
    test("compares the full path", () => {
      const path = new AssetPath("maps/world.voxelmap.json");

      assert.ok(path.equals(new AssetPath("maps/world.voxelmap.json")));
      assert.ok(!path.equals(new AssetPath("maps/world.json")));
    });
  });

  describe("serialization", () => {
    test("serializes as the full path", () => {
      const path = new AssetPath("maps/world.voxelmap.json");

      assert.strictEqual(String(path), "maps/world.voxelmap.json");
      assert.strictEqual(
        JSON.stringify({ path }),
        "{\"path\":\"maps/world.voxelmap.json\"}"
      );
    });
  });
});
