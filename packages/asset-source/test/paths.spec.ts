// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetPathEscapeError,
  FolderSet,
  isStatePath,
  normalizeAssetPath,
  safeAssetPath,
  STATE_DIRECTORY
} from "#src/index.ts";

describe("safeAssetPath", () => {
  test("keeps a root-relative path and collapses inner segments", () => {
    for (const [input, expected] of [
      ["sprite.png", "sprite.png"],
      ["textures\\tiles\\grass.png", "textures/tiles/grass.png"],
      ["./sprite.png", "sprite.png"],
      ["textures/tiles/../grass.png", "textures/grass.png"],
      ["textures//grass.png", "textures/grass.png"]
    ]) {
      const result = safeAssetPath(input);

      assert.strictEqual(result.ok, true, input);
      assert.strictEqual(result.val, expected, input);
    }
  });

  test("reports why a path is refused", () => {
    for (const [input, reason] of [
      ["", "empty"],
      ["sprite\u0000.png", "invalid"],
      ["sprite\n.png", "invalid"],
      ["/etc/passwd", "absolute"],
      ["\\\\server\\share\\a.png", "absolute"],
      ["C:/Windows/win.ini", "absolute"],
      ["..", "traversal"],
      ["../secret.txt", "traversal"],
      ["textures/../../secret.txt", "traversal"],
      ["..\\secret.txt", "traversal"],
      [".", "directory"],
      ["textures/", "directory"],
      ["./", "directory"],
      ["textures/..", "directory"],
      ["sprite.png:stream", "reserved"],
      ["sprite.", "reserved"],
      ["sprite ", "reserved"],
      ["CON", "reserved"],
      ["textures/nul.png", "reserved"],
      ["aux/sprite.png", "reserved"]
    ]) {
      const result = safeAssetPath(input);

      assert.strictEqual(result.ok, false, input);
      assert.strictEqual(result.val, reason, input);
    }
  });
});

describe("normalizeAssetPath", () => {
  test("throws an AssetPathEscapeError carrying the reason", () => {
    assert.throws(
      () => normalizeAssetPath("../secret.txt"),
      (error: AssetPathEscapeError) => {
        assert.strictEqual(error instanceof AssetPathEscapeError, true);
        assert.strictEqual(error.path, "../secret.txt");
        assert.strictEqual(error.reason, "traversal");

        return true;
      }
    );
  });

  test("returns the normalized path", () => {
    assert.strictEqual(
      normalizeAssetPath("textures\\grass.png"),
      "textures/grass.png"
    );
  });
});

describe("isStatePath", () => {
  test("matches the state directory whatever the case", () => {
    for (const input of [
      STATE_DIRECTORY,
      `${STATE_DIRECTORY}/state.json`,
      ".JOLLYPIXEL/state.json",
      ".JollyPixel/events.db"
    ]) {
      assert.strictEqual(isStatePath(input), true, input);
    }
  });

  test("leaves a lookalike path alone", () => {
    for (const input of [
      "jollypixel/state.json",
      ".jollypixel-backup/state.json",
      "textures/.jollypixel/a.png"
    ]) {
      assert.strictEqual(isStatePath(input), false, input);
    }
  });
});

describe("FolderSet", () => {
  test("adding a folder adds its parents once", () => {
    const folders = new FolderSet()
      .add("maps/world")
      .add("maps");

    assert.deepEqual(folders.toJSON(), [
      "maps",
      "maps/world"
    ]);
  });

  test("addParentsOf adds the folders above a path but not the path", () => {
    const folders = new FolderSet().addParentsOf("maps/world/a.json");

    assert.deepEqual(folders.toJSON(), [
      "maps",
      "maps/world"
    ]);
  });

  test("subtree lists the root and the folders under it, not lookalikes", () => {
    const folders = new FolderSet([
      "maps/world",
      "mapsuffix",
      "tiles"
    ]);

    assert.deepEqual(folders.subtree("maps"), [
      "maps",
      "maps/world"
    ]);
  });

  test("prune removes the subtree folders holding none of the files", () => {
    const folders = new FolderSet([
      "maps/draft/deep",
      "maps/world",
      "mapsuffix"
    ]);

    const pruned = folders.prune("maps", ["maps/world/a.json"]);

    assert.deepEqual(pruned, [
      "maps/draft",
      "maps/draft/deep"
    ]);
    assert.deepEqual(folders.toJSON(), [
      "maps",
      "maps/world",
      "mapsuffix"
    ]);
  });

  test("equals compares contents regardless of insertion order", () => {
    const left = new FolderSet(["a", "b"]);

    assert.strictEqual(left.equals(new FolderSet(["b", "a"])), true);
    assert.strictEqual(left.equals(new FolderSet(["a"])), false);
  });
});
