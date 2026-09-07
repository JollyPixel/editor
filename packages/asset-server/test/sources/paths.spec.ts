// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetPathEscapeError,
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
      ["./", "directory"]
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
