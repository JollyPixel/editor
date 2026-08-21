// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MemoryAssetSource,
  seedAssetSource
} from "#src/index.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

describe("seedAssetSource", () => {
  test("writes the documents a workspace does not hold yet", async() => {
    const source = new MemoryAssetSource();

    const written = await seedAssetSource(source, {
      "textures/block.pixelart": () => bytes("pixels"),
      "maps/overworld.voxelmap.json": () => bytes("{}")
    });

    assert.deepStrictEqual(written, [
      "textures/block.pixelart",
      "maps/overworld.voxelmap.json"
    ]);
    assert.deepStrictEqual(await source.list(), [
      "maps/overworld.voxelmap.json",
      "textures/block.pixelart"
    ]);
  });

  test("never overwrites an existing document", async() => {
    const source = new MemoryAssetSource([
      ["textures/block.pixelart", bytes("edited")]
    ]);

    const written = await seedAssetSource(source, {
      "textures/block.pixelart": () => bytes("starter")
    });

    assert.deepStrictEqual(written, []);
    assert.strictEqual(
      text(await source.read("textures/block.pixelart")),
      "edited"
    );
  });

  test("awaits an asynchronous factory", async() => {
    const source = new MemoryAssetSource();

    await seedAssetSource(source, {
      "a.bin": () => Promise.resolve(bytes("later"))
    });

    assert.strictEqual(text(await source.read("a.bin")), "later");
  });

  test("does not call the factory of an existing document", async() => {
    const source = new MemoryAssetSource([["a.bin", bytes("kept")]]);
    let calls = 0;

    await seedAssetSource(source, {
      "a.bin": () => {
        calls += 1;

        return bytes("starter");
      }
    });

    assert.strictEqual(calls, 0);
  });
});
