// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FilesystemAssetSource,
  MemoryAssetSource,
  type AssetSource
} from "#src/index.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

interface SourceFixture extends AsyncDisposable {
  readonly source: AssetSource;
}

const implementations: {
  name: string;
  create(): Promise<SourceFixture>;
}[] = [
  {
    name: "MemoryAssetSource",
    create: () => Promise.resolve({
      source: new MemoryAssetSource(),
      [Symbol.asyncDispose]: () => Promise.resolve()
    })
  },
  {
    name: "FilesystemAssetSource",
    create: async() => {
      const workspace = await tempWorkspace();

      return {
        source: new FilesystemAssetSource(workspace.root),
        [Symbol.asyncDispose]: () => workspace[Symbol.asyncDispose]()
      };
    }
  }
];

for (const implementation of implementations) {
  describe(`${implementation.name} — AssetSource conformance`, () => {
    test("round-trips written bytes", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("sprite.png", bytes("hello"));

      assert.strictEqual(
        text(await fixture.source.read("sprite.png")),
        "hello"
      );
    });

    test("overwrites an existing path", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("sprite.png", bytes("one"));
      await fixture.source.write("sprite.png", bytes("two"));

      assert.strictEqual(
        text(await fixture.source.read("sprite.png")),
        "two"
      );
    });

    test("reading a missing path rejects", async() => {
      await using fixture = await implementation.create();

      await assert.rejects(
        () => fixture.source.read("missing.png")
      );
    });

    test("deleting a missing path is a no-op", async() => {
      await using fixture = await implementation.create();

      await fixture.source.delete("missing.png");

      assert.deepEqual(await fixture.source.list(), []);
    });

    test("delete removes a written path", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("sprite.png", bytes("hello"));
      await fixture.source.delete("sprite.png");

      assert.deepEqual(await fixture.source.list(), []);
    });

    test("list returns sorted root-relative POSIX paths", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("b/second.png", bytes("2"));
      await fixture.source.write("a.png", bytes("1"));
      await fixture.source.write("b/first.png", bytes("3"));

      assert.deepEqual(await fixture.source.list(), [
        "a.png",
        "b/first.png",
        "b/second.png"
      ]);
    });

    test("nested paths round-trip", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("deep/nested/dir/file.bin", bytes("x"));

      assert.strictEqual(
        text(await fixture.source.read("deep/nested/dir/file.bin")),
        "x"
      );
    });

    test("accepts a Windows separator and normalizes it", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("a\\b.png", bytes("x"));

      assert.deepEqual(await fixture.source.list(), ["a/b.png"]);
      assert.strictEqual(
        text(await fixture.source.read("a/b.png")),
        "x"
      );
    });

    test("rejects a path escaping the root", async() => {
      await using fixture = await implementation.create();

      await assert.rejects(
        () => fixture.source.write("../outside.png", bytes("x")),
        { name: "AssetPathEscapeError" }
      );
      await assert.rejects(
        () => fixture.source.read("../outside.png"),
        { name: "AssetPathEscapeError" }
      );
      await assert.rejects(
        () => fixture.source.delete("nested/../../outside.png"),
        { name: "AssetPathEscapeError" }
      );
    });

    test("rejects an absolute path", async() => {
      await using fixture = await implementation.create();

      await assert.rejects(
        () => fixture.source.write("/etc/passwd", bytes("x")),
        { name: "AssetPathEscapeError" }
      );
    });

    test("list is empty on a fresh source", async() => {
      await using fixture = await implementation.create();

      assert.deepEqual(await fixture.source.list(), []);
    });
  });
}

for (const implementation of implementations) {
  describe(`${implementation.name} — state directory`, () => {
    test("list excludes the workspace state directory", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write(".jollypixel/assets.json", bytes("{}"));
      await fixture.source.write("sprite.png", bytes("x"));

      assert.deepEqual(await fixture.source.list(), ["sprite.png"]);
    });

    test("the state directory stays readable", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write(".jollypixel/assets.json", bytes("{}"));

      assert.strictEqual(
        text(await fixture.source.read(".jollypixel/assets.json")),
        "{}"
      );
    });
  });
}
