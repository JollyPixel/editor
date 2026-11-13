// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  BakedRoomEnvironment
} from "../../../../src/three/rendering/environment/BakedRoomEnvironment.ts";

// CONSTANTS
const kMapPath = new URL(
  "../../../../src/three/rendering/environment/roomEnvironment.bin",
  import.meta.url
);

async function shippedTexels(): Promise<Uint16Array> {
  const bytes = await fs.readFile(kMapPath);

  return new Uint16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Uint16Array.BYTES_PER_ELEMENT
  );
}

describe("Systems.BakedRoomEnvironment", () => {
  test("rejects texels of another size than the map", () => {
    assert.throws(
      () => new BakedRoomEnvironment(new Uint16Array(8)),
      RangeError
    );
  });

  test("requests the map once, after the calling job ends", async(t) => {
    const bytes = await fs.readFile(kMapPath);
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

  test("copies each mip level into a PMREM cube render target on WebGPU", async() => {
    const texels = await shippedTexels();
    const calls: string[] = [];
    const initialized: THREE.RenderTarget[] = [];
    const copies: Array<{
      from: THREE.DataArrayTexture;
      to: THREE.Texture;
      level: number | undefined;
    }> = [];

    const renderer: Pick<
      THREE.Renderer,
      "initRenderTarget" | "copyTextureToTexture"
    > & {
      backend: { isWebGPUBackend: true; };
    } = {
      backend: {
        isWebGPUBackend: true
      },
      initRenderTarget(renderTarget) {
        calls.push("init");
        initialized.push(renderTarget);
      },
      copyTextureToTexture(...args) {
        const [from, to, , , , level] = args;
        calls.push(`copy ${level}`);
        assert.ok(from instanceof THREE.DataArrayTexture);
        copies.push({ from, to, level });
        from.addEventListener("dispose", () => calls.push("dispose upload"));
      }
    };

    const target = new BakedRoomEnvironment(texels)
      .createRenderTarget(renderer as unknown as THREE.Renderer);

    assert.deepEqual(calls, [
      "init",
      "copy 0",
      "dispose upload",
      "copy 1",
      "dispose upload",
      "copy 2",
      "dispose upload",
      "copy 3",
      "dispose upload"
    ]);
    assert.deepEqual(initialized, [target]);
    assert.ok(copies.every(({ to }) => to === target.texture));
    assert.deepEqual(
      copies.map(({ from }) => [from.image.width, from.image.depth]),
      [[64, 6], [32, 6], [16, 6], [8, 6]]
    );
    assert.deepEqual(
      Uint16Array.from(copies.flatMap(({ from }) => [...from.image.data ?? []])),
      texels
    );
    assert.ok(target instanceof THREE.CubeRenderTarget);
    assert.equal(target.texture.isPMREMTexture, true);
    assert.equal(target.texture.type, THREE.HalfFloatType);
    assert.deepEqual(
      target.texture.mipmaps.map(({ width }) => width),
      [64, 32, 16, 8]
    );
  });
});
