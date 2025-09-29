// Import Node.js Dependencies
import { test, describe } from "node:test";
import assert from "node:assert";

// Import Internal Dependencies
import { Asset } from "../../../src/systems/Asset/Base.js";

describe("Systems.Asset", () => {
  test("should create asset with valid path", () => {
    const asset = new Asset("/textures/player.png");

    assert.strictEqual(asset.name, "player");
    assert.strictEqual(asset.ext, ".png");
    assert.strictEqual(asset.path, "/textures/");
    assert.strictEqual(asset.type, "unknown");
    assert.ok(asset.id);
  });

  test("should create asset with custom type", () => {
    const asset = new Asset("/models/character.gltf", "model");

    assert.strictEqual(asset.type, "model");
  });

  test("should generate basename correctly", () => {
    const asset = new Asset("/audio/music.mp3");

    assert.strictEqual(asset.basename, "music.mp3");
  });

  test("should convert to string path", () => {
    const asset = new Asset("/images/logo.jpg");

    assert.strictEqual(asset.toString(), "/images/logo.jpg");
  });

  test("should create from existing Asset instance", () => {
    const originalAsset = new Asset("/test.png", "texture");
    const newAsset = Asset.from(originalAsset);

    assert.strictEqual(newAsset, originalAsset);
  });

  test("should create from string path", () => {
    const asset = Asset.from("/create/from/string.wav");

    assert.strictEqual(asset.name, "string");
    assert.strictEqual(asset.ext, ".wav");
    assert.strictEqual(asset.path, "/create/from/");
  });

  test("should handle file without extension", () => {
    const asset = new Asset("/configs/settings");

    assert.strictEqual(asset.name, "settings");
    assert.strictEqual(asset.ext, "");
    assert.strictEqual(asset.basename, "settings");
  });

  test("should generate unique IDs", () => {
    const asset1 = new Asset("/test1.png");
    const asset2 = new Asset("/test2.png");

    assert.notStrictEqual(asset1.id, asset2.id);
  });
});
