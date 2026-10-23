// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { AtomicFile } from "@openally/atomic-fs";

// Import Internal Dependencies
import { FilesystemTree } from "#src/persistence/filesystem/FilesystemTree.ts";
import { tempWorkspace } from "../../helpers/tempWorkspace.ts";

// CONSTANTS
const kAtomic = new AtomicFile();

function tree(
  root: string,
  ignore: readonly string[] = []
): FilesystemTree {
  return new FilesystemTree(root, {
    ignore,
    isTemporary: kAtomic.isTemporary
  });
}

async function collect(
  iterator: AsyncIterableIterator<string>
): Promise<string[]> {
  const files: string[] = [];
  for await (const file of iterator) {
    files.push(file);
  }

  return files;
}

async function writeFiles(
  root: string,
  files: readonly string[]
): Promise<void> {
  for (const file of files) {
    const absolute = path.join(root, file);
    await fs.mkdir(path.dirname(absolute), {
      recursive: true
    });
    await fs.writeFile(absolute, "");
  }
}

describe("FilesystemTree", () => {
  test("yields root-relative POSIX file paths", async() => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, [
      "a.png",
      "b/c/d.png"
    ]);

    const files = await collect(
      tree(workspace.root).files()
    );

    assert.deepEqual(files.sort(), [
      "a.png",
      "b/c/d.png"
    ]);
  });

  test("does not yield directories or temporary files", async() => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, [
      "empty/.keep.deadbeefcafe.tmp",
      ".sprite.png.deadbeefcafe.tmp"
    ]);

    const files = await collect(
      tree(workspace.root).files()
    );

    assert.deepEqual(files, []);
  });

  test("folders yields every folder but the ignored ones", async() => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, [
      "maps/world/overworld.json",
      "skip/nested/sprite.png"
    ]);
    await fs.mkdir(path.join(workspace.root, "empty"));

    const folders = await collect(
      tree(workspace.root, ["skip/**"]).folders()
    );

    assert.deepEqual(folders.sort(), [
      "empty",
      "maps",
      "maps/world"
    ]);
  });

  test("never opens an ignored directory", async(t) => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, [
      "keep/sprite.png",
      "skip/nested/sprite.png"
    ]);
    const opendir = t.mock.method(fs, "opendir");

    const files = await collect(
      tree(workspace.root, ["skip/**"]).files()
    );

    assert.deepEqual(files, ["keep/sprite.png"]);
    const opened = opendir.mock.calls.map(
      (call) => path.relative(workspace.root, String(call.arguments[0]))
    );
    assert.deepEqual(opened.sort(), ["", "keep"]);
  });

  test("stops lazily when the consumer returns early", async(t) => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, [
      "a/1.png",
      "b/2.png",
      "c/3.png"
    ]);
    const opendir = t.mock.method(fs, "opendir");

    const iterator = tree(workspace.root).files();
    const first = await iterator.next();
    await iterator.return?.();

    assert.match(String(first.value), /^[abc]\/\d\.png$/);
    assert.strictEqual(opendir.mock.callCount(), 2);
    for (const directory of ["a", "b", "c"]) {
      await fs.rm(path.join(workspace.root, directory), {
        recursive: true
      });
    }
    assert.deepEqual(await fs.readdir(workspace.root), []);
  });

  test("yields nothing when the root does not exist", async() => {
    await using workspace = await tempWorkspace();

    const files = await collect(
      tree(path.join(workspace.root, "missing")).files()
    );

    assert.deepEqual(files, []);
  });

  test("rejects when the root is a file", async() => {
    await using workspace = await tempWorkspace();
    await writeFiles(workspace.root, ["sprite.png"]);

    await assert.rejects(
      () => collect(
        tree(path.join(workspace.root, "sprite.png")).files()
      ),
      { code: "ENOTDIR" }
    );
  });

  test("does not follow symbolic links", async() => {
    await using workspace = await tempWorkspace();
    await using outside = await tempWorkspace();
    await writeFiles(workspace.root, ["sprite.png"]);
    await writeFiles(outside.root, ["secret.png"]);
    await fs.symlink(
      outside.root,
      path.join(workspace.root, "linked"),
      "junction"
    );

    const files = await collect(
      tree(workspace.root).files()
    );

    assert.deepEqual(files, ["sprite.png"]);
  });
});
