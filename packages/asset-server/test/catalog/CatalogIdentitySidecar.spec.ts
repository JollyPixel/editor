// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  contentHash,
  CatalogIdentitySidecar,
  IDENTITY_SIDECAR_PATH,
  MemoryAssetSource
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";

describe("CatalogIdentitySidecar — mapping", () => {
  test("indexes entries by path and by id", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assert.deepEqual(sidecar.byPath("a.png"), {
      id: "1",
      path: "a.png",
      kind: "pixelart"
    });
    assert.strictEqual(sidecar.byId("1")?.path, "a.png");
    assert.strictEqual(sidecar.byPath("missing.png"), undefined);
  });

  test("re-setting an id moves it, dropping the previous path", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    sidecar.set({ id: "1", path: "b.png", kind: "pixelart" });

    assert.strictEqual(sidecar.byPath("a.png"), undefined);
    assert.strictEqual(sidecar.byPath("b.png")?.id, "1");
    assert.strictEqual(sidecar.size, 1);
  });

  test("taking over a path drops the id that held it", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    sidecar.set({ id: "2", path: "a.png", kind: "pixelart" });

    assert.strictEqual(sidecar.byId("1"), undefined);
    assert.strictEqual(sidecar.byPath("a.png")?.id, "2");
    assert.strictEqual(sidecar.size, 1);
    assert.deepEqual([...sidecar], [
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);
  });

  test("a path is never serialized twice", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" },
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);

    assert.deepEqual(sidecar.toJSON().assets, [
      { id: "2", path: "a.png", kind: "pixelart" }
    ]);
  });

  test("removeById drops both indexes", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    assert.strictEqual(sidecar.removeById("1"), true);
    assert.strictEqual(sidecar.removeById("1"), false);
    assert.strictEqual(sidecar.size, 0);
    assert.strictEqual(sidecar.byPath("a.png"), undefined);
  });

  test("serializes entries sorted by path", () => {
    const sidecar = new CatalogIdentitySidecar([
      { id: "2", path: "b.png", kind: "binary" },
      { id: "1", path: "a.png", kind: "binary" }
    ]);

    assert.deepEqual(sidecar.toJSON(), {
      version: 1,
      assets: [
        { id: "1", path: "a.png", kind: "binary" },
        { id: "2", path: "b.png", kind: "binary" }
      ]
    });
  });
});

describe("CatalogIdentitySidecar — persistence", () => {
  test("round-trips through an AssetSource", async() => {
    const source = new MemoryAssetSource();
    const sidecar = new CatalogIdentitySidecar([
      { id: "1", path: "a.png", kind: "pixelart" }
    ]);

    await sidecar.save(source);
    const loaded = await CatalogIdentitySidecar.load(source);

    assert.deepEqual(loaded.toJSON(), sidecar.toJSON());
  });

  test("writes to the reserved sidecar path, outside the listing", async() => {
    const source = new MemoryAssetSource();

    await new CatalogIdentitySidecar().save(source);

    assert.deepEqual(await source.list(), []);
    assert.match(
      new TextDecoder().decode(await source.read(IDENTITY_SIDECAR_PATH)),
      /"assets"/
    );
  });

  test("a missing sidecar loads as empty", async() => {
    const loaded = await CatalogIdentitySidecar.load(new MemoryAssetSource());

    assert.strictEqual(loaded.size, 0);
  });

  test("a truncated sidecar loads as empty rather than throwing", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      IDENTITY_SIDECAR_PATH,
      bytes('{"version":1,"assets":[{"id":"1","path"')
    );

    const loaded = await CatalogIdentitySidecar.load(source);

    assert.strictEqual(loaded.size, 0);
  });

  test("a corrupt sidecar drops only its malformed entries", async() => {
    const source = new MemoryAssetSource();
    await source.write(
      IDENTITY_SIDECAR_PATH,
      bytes(JSON.stringify({
        version: 1,
        assets: [
          { id: "1", path: "a.png", kind: "binary" },
          { id: 2, path: "b.png", kind: "binary" },
          null
        ]
      }))
    );

    const loaded = await CatalogIdentitySidecar.load(source);

    assert.strictEqual(loaded.size, 1);
    assert.strictEqual(loaded.byPath("a.png")?.id, "1");
  });

  test("a sidecar whose write never landed is treated as absent", async() => {
    const source = new MemoryAssetSource();

    const loaded = await CatalogIdentitySidecar.load(source);
    loaded.set({ id: "1", path: "a.png", kind: "binary" });

    assert.deepEqual(await source.list(), []);
    assert.strictEqual(loaded.size, 1);
  });
});

describe("contentHash", () => {
  test("is stable for identical bytes", () => {
    assert.strictEqual(
      contentHash(bytes("hello")),
      contentHash(bytes("hello"))
    );
  });

  test("differs for different bytes", () => {
    assert.notStrictEqual(
      contentHash(bytes("hello")),
      contentHash(bytes("world"))
    );
  });

  test("is a sha256 hex digest", () => {
    assert.match(contentHash(bytes("hello")), /^[0-9a-f]{64}$/);
  });
});
