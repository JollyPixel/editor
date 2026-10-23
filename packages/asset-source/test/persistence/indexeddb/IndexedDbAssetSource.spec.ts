// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { IndexedDbAssetSource } from "#src/persistence/indexeddb/IndexedDbAssetSource.ts";
import {
  bytes,
  text
} from "../../helpers/bytes.ts";

describe("IndexedDbAssetSource", () => {
  test("a reopened database keeps its assets", async() => {
    const name = crypto.randomUUID();
    const first = await IndexedDbAssetSource.open({ name });
    await first.write("maps/a.json", bytes("one"));
    first.close();

    const second = await IndexedDbAssetSource.open({ name });

    assert.deepEqual(await second.list(), ["maps/a.json"]);
    assert.strictEqual(text(await second.read("maps/a.json")), "one");
    second.close();
  });

  test("databases are isolated by name", async() => {
    const first = await IndexedDbAssetSource.open({
      name: crypto.randomUUID()
    });
    const second = await IndexedDbAssetSource.open({
      name: crypto.randomUUID()
    });

    await first.write("a.png", bytes("x"));

    assert.deepEqual(await second.list(), []);
    first.close();
    second.close();
  });

  test("keeps state files readable but unlisted", async() => {
    const source = await IndexedDbAssetSource.open({
      name: crypto.randomUUID()
    });

    await source.write(".jollypixel/assets.json", bytes("{}"));

    assert.deepEqual(await source.list(), []);
    assert.strictEqual(await source.exists(".jollypixel/assets.json"), true);
    source.close();
  });

  test("stores a copy of the written bytes", async() => {
    const source = await IndexedDbAssetSource.open({
      name: crypto.randomUUID()
    });
    const data = bytes("one");

    const written = source.write("a.png", data);
    data.fill(0);
    await written;

    assert.strictEqual(text(await source.read("a.png")), "one");
    source.close();
  });

  test("destroy empties the database", async() => {
    const name = crypto.randomUUID();
    const first = await IndexedDbAssetSource.open({ name });
    await first.write("a.png", bytes("x"));
    first.close();

    await IndexedDbAssetSource.destroy({ name });

    const second = await IndexedDbAssetSource.open({ name });
    assert.deepEqual(await second.list(), []);
    second.close();
  });

  test("a closed database rejects the write", async() => {
    const source = await IndexedDbAssetSource.open({
      name: crypto.randomUUID()
    });
    source.close();

    await assert.rejects(() => source.write("a.png", bytes("x")));
  });

  test("destroy closes a source still open on the database", {
    timeout: 1000
  }, async(t) => {
    const name = crypto.randomUUID();
    const source = await IndexedDbAssetSource.open({ name });
    t.after(() => source.close());
    await source.write("a.png", bytes("x"));

    await IndexedDbAssetSource.destroy({ name });

    await assert.rejects(() => source.write("b.png", bytes("y")));
  });
});
