// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  BINARY_KIND,
  binaryAssetHandler,
  type AssetKindHandler
} from "#src/index.ts";

function handler(
  kind: string,
  match: string[]
): AssetKindHandler<{ value: string; }> {
  return {
    kind,
    match,
    create: () => {
      return { value: "" };
    },
    apply: () => void 0,
    serialize: () => Promise.resolve(new Uint8Array())
  };
}

describe("AssetKindRegistry — resolution", () => {
  test("resolves a path to the handler claiming it", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", ["**/*.png"])
    ]);

    assert.strictEqual(registry.resolve("a/b.png").kind, "pixelart");
  });

  test("falls back to the binary kind when nothing claims the path", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", ["**/*.png"])
    ]);

    assert.strictEqual(registry.resolve("a/b.wav").kind, BINARY_KIND);
  });

  test("the first registration claiming a path wins", () => {
    const registry = new AssetKindRegistry([
      handler("first", ["textures/**"]),
      handler("second", ["**/*.png"])
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, "first");
  });

  test("matches dotfiles", () => {
    const registry = new AssetKindRegistry([
      handler("config", ["**/.editorconfig"])
    ]);

    assert.strictEqual(registry.resolve(".editorconfig").kind, "config");
  });
});

describe("AssetKindRegistry — lookup", () => {
  test("get returns a registered handler", () => {
    const pixelart = handler("pixelart", ["**/*.png"]);
    const registry = new AssetKindRegistry([pixelart]);

    assert.strictEqual(registry.get("pixelart"), pixelart);
  });

  test("get returns the built-in binary handler", () => {
    const registry = new AssetKindRegistry();

    assert.strictEqual(registry.get(BINARY_KIND), binaryAssetHandler);
    assert.strictEqual(registry.has(BINARY_KIND), true);
  });

  test("get throws for an unknown kind", () => {
    const registry = new AssetKindRegistry();

    assert.throws(
      () => registry.get("voxelmap"),
      { name: "UnknownAssetKindError", kind: "voxelmap" }
    );
  });

  test("kinds() lists registrations without the fallback", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", ["**/*.png"]),
      handler("voxelmap", ["**/*.vxm"])
    ]);

    assert.deepEqual([...registry.kinds()], ["pixelart", "voxelmap"]);
  });
});

describe("AssetKindRegistry — registration guards", () => {
  test("rejects a duplicate kind", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", ["**/*.png"])
    ]);

    assert.throws(
      () => registry.register(handler("pixelart", ["**/*.bmp"])),
      { name: "TypeError" }
    );
  });

  test("rejects replacing the built-in fallback", () => {
    const registry = new AssetKindRegistry();

    assert.throws(
      () => registry.register(handler(BINARY_KIND, ["**/*"])),
      { name: "TypeError" }
    );
  });
});
