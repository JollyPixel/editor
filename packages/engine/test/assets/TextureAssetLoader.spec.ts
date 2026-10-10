// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  TextureAssetLoader,
  type CompressedTextureLoader
} from "../../src/assets/index.ts";

function textureRecord(
  source: string
): AssetRecord {
  return new AssetRecord({
    id: "texture.grass",
    kind: "texture",
    source
  });
}

function compressedTextureLoader(
  requested: string[]
): CompressedTextureLoader {
  return {
    loadAsync: async(url) => {
      requested.push(url);

      return new THREE.CompressedTexture([], 16, 16);
    }
  };
}

describe("TextureAssetLoader", () => {
  test("loads a .ktx2 source through the KTX2 loader", async() => {
    const requested: string[] = [];
    const loader = new TextureAssetLoader(new THREE.LoadingManager(), {
      ktx2: compressedTextureLoader(requested)
    });

    const texture = await loader.load(textureRecord("textures/grass.KTX2"));

    assert.deepStrictEqual(requested, ["textures/grass.KTX2"]);
    assert.ok(texture instanceof THREE.CompressedTexture);
    assert.strictEqual(texture.magFilter, THREE.NearestFilter);
    assert.strictEqual(texture.minFilter, THREE.NearestFilter);
    assert.strictEqual(texture.colorSpace, THREE.SRGBColorSpace);
  });

  test("rejects a .ktx2 source when no KTX2 loader is configured", async() => {
    const loader = new TextureAssetLoader(new THREE.LoadingManager());

    await assert.rejects(
      loader.load(textureRecord("textures/grass.ktx2")),
      (error: Error) => {
        assert.strictEqual(
          error.message,
          "Failed to load texture: textures/grass.ktx2"
        );
        assert.strictEqual(
          (error.cause as Error).message,
          "No KTX2 loader configured"
        );

        return true;
      }
    );
  });
});
