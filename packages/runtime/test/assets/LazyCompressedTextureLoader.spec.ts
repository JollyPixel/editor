// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  LazyCompressedTextureLoader,
  type DisposableCompressedTextureLoader
} from "../../src/assets/LazyCompressedTextureLoader.ts";

class RecordingLoader implements DisposableCompressedTextureLoader {
  readonly requested: string[] = [];
  disposed = 0;

  async loadAsync(
    url: string
  ): Promise<THREE.CompressedTexture> {
    this.requested.push(url);

    return new THREE.CompressedTexture([], 4, 4);
  }

  dispose(): void {
    this.disposed++;
  }
}

describe("LazyCompressedTextureLoader", () => {
  test("creates one loader shared by concurrent loads", async() => {
    const inner = new RecordingLoader();
    let created = 0;
    const loader = new LazyCompressedTextureLoader(async() => {
      created++;

      return inner;
    });

    assert.equal(created, 0);
    await Promise.all([
      loader.loadAsync("a.ktx2"),
      loader.loadAsync("b.ktx2")
    ]);

    assert.equal(created, 1);
    assert.deepEqual(inner.requested, ["a.ktx2", "b.ktx2"]);
  });

  test("disposes a loader still being created", async() => {
    const inner = new RecordingLoader();
    const { promise, resolve } =
      Promise.withResolvers<DisposableCompressedTextureLoader>();
    const loader = new LazyCompressedTextureLoader(() => promise);

    const loading = loader.loadAsync("a.ktx2");
    loader.dispose();
    resolve(inner);
    await loading;

    assert.equal(inner.disposed, 1);
  });
});
