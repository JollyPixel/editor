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
  binaryAssetKind,
  type AssetKindHandler
} from "#src/index.ts";

function handler(
  kind: string,
  extensions: Record<string, string>,
  match?: string[]
): AssetKindHandler<{ value: string; }> {
  return {
    kind,
    extensions,
    match,
    create: () => {
      return { value: "" };
    },
    load: () => void 0,
    clear: () => void 0,
    serialize: () => Promise.resolve(new Uint8Array())
  };
}

describe("AssetKindRegistry — resolution", () => {
  test("resolves a path to the handler claiming its extension", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", { ".png": "image/png" })
    ]);

    assert.strictEqual(registry.resolve("a/b.png").kind, "pixelart");
  });

  test("claims a multi-dot extension", () => {
    const registry = new AssetKindRegistry([
      handler("voxelmap", { ".voxelmap.json": "application/json" })
    ]);

    assert.strictEqual(
      registry.resolve("maps/world.voxelmap.json").kind,
      "voxelmap"
    );
    assert.strictEqual(registry.resolve("maps/world.json").kind, BINARY_KIND);
  });

  test("falls back to the binary kind when nothing claims the path", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", { ".png": "image/png" })
    ]);

    assert.strictEqual(registry.resolve("a/b.wav").kind, BINARY_KIND);
  });

  test("the first registration claiming a path wins", () => {
    const registry = new AssetKindRegistry([
      handler("first", { ".png": "image/png" }, ["textures/**"]),
      handler("second", { ".png": "image/png" })
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, "first");
    assert.strictEqual(registry.resolve("sprites/a.png").kind, "second");
  });

  test("match narrows the claimed extensions", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", { ".png": "image/png" }, ["textures/**"])
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, "pixelart");
    assert.strictEqual(registry.resolve("textures/a.txt").kind, BINARY_KIND);
  });

  test("match globs include dotfiles", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", { ".png": "image/png" }, ["**/*.png"])
    ]);

    assert.strictEqual(registry.resolve("a/.hidden.png").kind, "pixelart");
  });
});

describe("AssetKindRegistry — lookup", () => {
  test("get returns a registered handler", () => {
    const pixelart = handler("pixelart", { ".png": "image/png" });
    const registry = new AssetKindRegistry([pixelart]);

    assert.strictEqual(registry.get("pixelart"), pixelart);
  });

  test("get returns the built-in binary handler", () => {
    const registry = new AssetKindRegistry();

    assert.strictEqual(registry.get(BINARY_KIND), binaryAssetKind);
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
      handler("pixelart", { ".png": "image/png" }),
      handler("voxelmap", { ".vxm": "application/octet-stream" })
    ]);

    assert.deepEqual([...registry.kinds()], ["pixelart", "voxelmap"]);
  });
});

describe("AssetKindRegistry — content types", () => {
  test("collects the extensions every registered kind declares", () => {
    const registry = new AssetKindRegistry([
      handler("texture", { ".png": "image/png-custom" }),
      handler("voxelmap", { ".voxelmap.json": "application/json" })
    ]);

    assert.deepEqual(registry.contentTypes(), {
      ".png": "image/png-custom",
      ".voxelmap.json": "application/json"
    });
  });

  test("a later registration wins on a shared extension", () => {
    const registry = new AssetKindRegistry([
      handler("first", { ".png": "image/first" })
    ]);
    registry.register(handler("second", { ".png": "image/second" }));

    assert.deepEqual(registry.contentTypes(), { ".png": "image/second" });
  });

  test("is empty when no kind is registered", () => {
    assert.deepEqual(new AssetKindRegistry().contentTypes(), {});
  });
});

describe("AssetKindRegistry — registration guards", () => {
  test("rejects a duplicate kind", () => {
    const registry = new AssetKindRegistry([
      handler("pixelart", { ".png": "image/png" })
    ]);

    assert.throws(
      () => registry.register(handler("pixelart", { ".bmp": "image/bmp" })),
      { name: "TypeError" }
    );
  });

  test("rejects replacing the built-in fallback", () => {
    const registry = new AssetKindRegistry();

    assert.throws(
      () => registry.register(handler(BINARY_KIND, { ".bin": "x" })),
      { name: "TypeError" }
    );
  });

  test("rejects a kind declaring no extensions", () => {
    const registry = new AssetKindRegistry();

    assert.throws(
      () => registry.register(handler("empty", {})),
      { name: "TypeError", message: /declares no extensions/ }
    );
  });

  test("rejects an extension without a leading dot", () => {
    const registry = new AssetKindRegistry();

    for (const extension of ["png", "."]) {
      assert.throws(
        () => registry.register(handler("bad", { [extension]: "image/png" })),
        { name: "TypeError", message: /invalid extension/ }
      );
    }
  });
});
