// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { BakedRoomEnvironment } from "#src/index.ts";

// CONSTANTS
const kAtlasPath = new URL(
  "../../src/environment/roomEnvironment.bin",
  import.meta.url
);

async function shippedTexels(): Promise<Uint16Array> {
  const bytes = await fs.readFile(kAtlasPath);

  return new Uint16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Uint16Array.BYTES_PER_ELEMENT
  );
}

describe("BakedRoomEnvironment", () => {
  test("rejects texels of another size than the atlas", () => {
    assert.throws(
      () => new BakedRoomEnvironment(new Uint16Array(8)),
      RangeError
    );
  });

  test("requests the atlas once, after the calling job ends", async(t) => {
    const bytes = await fs.readFile(kAtlasPath);
    const request = t.mock.method(
      globalThis,
      "fetch",
      async() => new Response(bytes)
    );

    const loading = BakedRoomEnvironment.load();
    assert.equal(request.mock.callCount(), 0);

    const first = await loading;
    const second = await BakedRoomEnvironment.load();

    assert.equal(request.mock.callCount(), 1);
    assert.equal(second, first);
  });

  test("copies the texels into a PMREM render target", async() => {
    const texels = await shippedTexels();
    const calls: string[] = [];
    const initialized: THREE.RenderTarget[] = [];
    const copies: Array<{
      from: THREE.Texture;
      to: THREE.Texture;
    }> = [];

    const target = new BakedRoomEnvironment(texels).createRenderTarget({
      initRenderTarget(renderTarget) {
        calls.push("init");
        initialized.push(renderTarget);
      },
      copyTextureToTexture(from, to) {
        calls.push("copy");
        copies.push({ from, to });
        from.addEventListener("dispose", () => calls.push("dispose upload"));
      }
    });

    assert.deepEqual(calls, ["init", "copy", "dispose upload"]);
    assert.deepEqual(initialized, [target]);
    const [{ from, to }] = copies;
    assert.equal(to, target.texture);
    assert.ok(from instanceof THREE.DataTexture);
    assert.equal(from.image.data, texels);
    assert.equal(target.texture.mapping, THREE.CubeUVReflectionMapping);
    assert.equal(target.texture.type, THREE.HalfFloatType);
    assert.deepEqual([target.width, target.height], [336, 256]);
  });
});
