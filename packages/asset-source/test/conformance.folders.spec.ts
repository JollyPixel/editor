// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sourceImplementations } from "./helpers/sourceImplementations.ts";
import {
  bytes,
  text
} from "./helpers/bytes.ts";

for (const implementation of sourceImplementations) {
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

for (const implementation of sourceImplementations) {
  describe(`${implementation.name} — folders`, () => {
    test("lists the folders of written files, sorted", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("maps/world/overworld.json", bytes("{}"));
      await fixture.source.write("a.png", bytes("1"));

      assert.deepEqual(await fixture.source.folders(), [
        "maps",
        "maps/world"
      ]);
    });

    test("keeps a folder once its last file is deleted", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write("maps/overworld.json", bytes("{}"));
      await fixture.source.delete("maps/overworld.json");

      assert.deepEqual(await fixture.source.folders(), ["maps"]);
    });

    test("creates an empty folder with its parents", async() => {
      await using fixture = await implementation.create();

      await fixture.source.createFolder("maps/draft");
      await fixture.source.createFolder("maps/draft");

      assert.deepEqual(await fixture.source.folders(), [
        "maps",
        "maps/draft"
      ]);
      assert.deepEqual(await fixture.source.list(), []);
    });

    test("deletes a folder and its empty sub-folders", async() => {
      await using fixture = await implementation.create();

      await fixture.source.createFolder("maps/draft/deep");
      await fixture.source.createFolder("mapsuffix");
      await fixture.source.deleteFolder("maps");

      assert.deepEqual(await fixture.source.folders(), ["mapsuffix"]);
    });

    test("keeps the sub-folders that still hold a file", async() => {
      await using fixture = await implementation.create();

      await fixture.source.createFolder("maps/draft");
      await fixture.source.write("maps/world/overworld.json", bytes("{}"));
      await fixture.source.deleteFolder("maps");

      assert.deepEqual(await fixture.source.folders(), [
        "maps",
        "maps/world"
      ]);
    });

    test("deleting a missing folder is a no-op", async() => {
      await using fixture = await implementation.create();

      await fixture.source.deleteFolder("missing");

      assert.deepEqual(await fixture.source.folders(), []);
    });

    test("excludes the workspace state directory", async() => {
      await using fixture = await implementation.create();

      await fixture.source.write(".jollypixel/assets.json", bytes("{}"));

      assert.deepEqual(await fixture.source.folders(), []);
    });

    test("rejects a folder escaping the root", async() => {
      await using fixture = await implementation.create();

      await assert.rejects(
        () => fixture.source.createFolder("../outside"),
        { name: "AssetPathEscapeError" }
      );
      await assert.rejects(
        () => fixture.source.deleteFolder("../outside"),
        { name: "AssetPathEscapeError" }
      );
    });
  });
}
