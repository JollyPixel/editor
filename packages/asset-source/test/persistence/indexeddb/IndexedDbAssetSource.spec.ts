// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { IDBFactory } from "fake-indexeddb";

// Import Internal Dependencies
import { IndexedDbAssetSource } from "#src/persistence/indexeddb/index.ts";
import {
  bytes,
  text
} from "../../helpers/bytes.ts";

describe("IndexedDbAssetSource", () => {
  test("a reopened database keeps its assets", async() => {
    const factory = new IDBFactory();
    const first = await IndexedDbAssetSource.open({ name: "w", factory });
    await first.write("maps/a.json", bytes("one"));
    first.close();

    const second = await IndexedDbAssetSource.open({ name: "w", factory });

    assert.deepEqual(await second.list(), ["maps/a.json"]);
    assert.strictEqual(text(await second.read("maps/a.json")), "one");
    second.close();
  });

  test("databases are isolated by name", async() => {
    const factory = new IDBFactory();
    const first = await IndexedDbAssetSource.open({ name: "one", factory });
    const second = await IndexedDbAssetSource.open({ name: "two", factory });

    await first.write("a.png", bytes("x"));

    assert.deepEqual(await second.list(), []);
    first.close();
    second.close();
  });

  test("keeps state files readable but unlisted", async() => {
    const source = await IndexedDbAssetSource.open({
      name: "w",
      factory: new IDBFactory()
    });

    await source.write(".jollypixel/assets.json", bytes("{}"));

    assert.deepEqual(await source.list(), []);
    assert.strictEqual(await source.exists(".jollypixel/assets.json"), true);
    source.close();
  });

  test("stores a copy of the written bytes", async() => {
    const source = await IndexedDbAssetSource.open({
      name: "w",
      factory: new IDBFactory()
    });
    const data = bytes("one");

    const written = source.write("a.png", data);
    data.fill(0);
    await written;

    assert.strictEqual(text(await source.read("a.png")), "one");
    source.close();
  });

  test("destroy empties the database", async() => {
    const factory = new IDBFactory();
    const first = await IndexedDbAssetSource.open({ name: "w", factory });
    await first.write("a.png", bytes("x"));
    first.close();

    await IndexedDbAssetSource.destroy({ name: "w", factory });

    const second = await IndexedDbAssetSource.open({ name: "w", factory });
    assert.deepEqual(await second.list(), []);
    second.close();
  });

  test("a closed database rejects the write", async() => {
    const source = await IndexedDbAssetSource.open({
      name: "w",
      factory: new IDBFactory()
    });
    source.close();

    await assert.rejects(() => source.write("a.png", bytes("x")));
  });
});
