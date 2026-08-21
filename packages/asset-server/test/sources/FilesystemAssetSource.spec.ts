// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import { FilesystemAssetSource } from "#src/index.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

describe("FilesystemAssetSource — listing", () => {
  test("skips .jollypixel/ and the other default ignores", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    await fs.mkdir(path.join(workspace.root, ".jollypixel"));
    await fs.writeFile(
      path.join(workspace.root, ".jollypixel", "assets.json"),
      "{}"
    );
    await fs.mkdir(path.join(workspace.root, "node_modules", "pkg"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(workspace.root, "node_modules", "pkg", "index.js"),
      ""
    );
    await source.write("sprite.png", bytes("x"));

    assert.deepEqual(await source.list(), ["sprite.png"]);
  });

  test("honours extra ignore globs", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root, {
      ignore: ["**/*.log"]
    });

    await source.write("sprite.png", bytes("x"));
    await source.write("debug.log", bytes("y"));

    assert.deepEqual(await source.list(), ["sprite.png"]);
    assert.strictEqual(source.isIgnored("debug.log"), true);
    assert.strictEqual(source.isIgnored("sprite.png"), false);
  });

  test("returns POSIX separators from a Windows-shaped root", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    await source.write("textures/tiles/grass.png", bytes("x"));

    assert.deepEqual(await source.list(), ["textures/tiles/grass.png"]);
  });
});

describe("FilesystemAssetSource — atomic write", () => {
  test("leaves no temporary file behind on success", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    await source.write("sprite.png", bytes("hello"));

    const entries = await fs.readdir(workspace.root);
    assert.deepEqual(entries, ["sprite.png"]);
  });

  test("an interrupted write leaves the previous content readable", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);
    await source.write("sprite.png", bytes("first"));

    // Simulates a crash between the temp write and the rename.
    await fs.writeFile(
      path.join(workspace.root, ".sprite.png.deadbeef.tmp"),
      bytes("second")
    );

    assert.strictEqual(
      text(await source.read("sprite.png")),
      "first"
    );
    assert.deepEqual(await source.list(), ["sprite.png"]);
  });

  test("creates missing parent directories", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    await source.write("a/b/c/sprite.png", bytes("x"));

    assert.strictEqual(
      text(await source.read("a/b/c/sprite.png")),
      "x"
    );
  });
});

describe("FilesystemAssetSource — resolve", () => {
  test("resolves against the root", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    assert.strictEqual(
      source.resolve("a/b.png"),
      path.join(workspace.root, "a", "b.png")
    );
  });

  test("throws for a traversal that escapes the root", async() => {
    await using workspace = await tempWorkspace();
    const source = new FilesystemAssetSource(workspace.root);

    assert.throws(
      () => source.resolve("a/../../b.png"),
      { name: "AssetPathEscapeError" }
    );
  });
});
