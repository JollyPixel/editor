// Import Node.js Dependencies
import { test, describe } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { AssetLoader } from "../../../src/systems/asset/Loader.ts";

describe("Systems.AssetLoader", () => {
  test("constructor sets type, extensions, and load", () => {
    async function load(_asset: any, _context: any) {
      return "ok";
    }
    const loader = new AssetLoader({
      type: "texture",
      extensions: [".png", ".jpg"],
      load
    });

    assert.strictEqual(loader.type, "texture");
    assert.deepStrictEqual(loader.extensions, [".png", ".jpg"]);
    assert.strictEqual(loader.load, load);
  });

  test("extensions is spread from an iterable", () => {
    const extensionSet = new Set([".glb", ".gltf"]);
    const loader = new AssetLoader({
      type: "model",
      extensions: extensionSet,
      load: (_asset: any, _context: any) => Promise.resolve(null as any)
    });

    assert.ok(Array.isArray(loader.extensions));
    assert.deepStrictEqual(loader.extensions, [".glb", ".gltf"]);
  });

  test("extensions is a ReadonlyArray", () => {
    const loader = new AssetLoader({
      type: "font",
      extensions: [".typeface.json"],
      load: (_asset: any, _context: any) => Promise.resolve(null as any)
    });

    assert.ok(Array.isArray(loader.extensions));
    assert.strictEqual(loader.extensions.length, 1);
    assert.strictEqual(loader.extensions[0], ".typeface.json");
  });
});
