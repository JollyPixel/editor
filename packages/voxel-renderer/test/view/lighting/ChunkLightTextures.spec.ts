// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkLightTextures } from "../../../src/view/lighting/ChunkLightTextures.ts";
import { lightChunkKey } from "../../../src/view/lighting/LightGrid.ts";
import {
  GLOW_ID,
  litWorld,
  STONE_ID,
  type LitWorld
} from "../../helpers/lighting/litWorld.ts";

// CONSTANTS
const kOrigin = {
  key: "cell:0,0,0",
  origin: { x: 0, y: 0, z: 0 }
};
const kSpan = 18;

function texturesOf(
  { field, sources }: LitWorld
): ChunkLightTextures {
  return new ChunkLightTextures({
    field,
    sources
  });
}

function texelAt(
  texture: THREE.Data3DTexture,
  x: number,
  y: number,
  z: number
): number[] {
  const data = texture.image.data as Uint8Array;
  const offset = (x + ((y + (z * kSpan)) * kSpan)) * 4;

  return [...data.subarray(offset, offset + 4)];
}

describe("ChunkLightTextures", () => {
  it("draws nothing for a chunk no light reaches", () => {
    const world = litWorld();
    world.field.update();

    assert.equal(texturesOf(world).resolveLightTexture(kOrigin), null);
  });

  it("stores the chunk and a one-cell apron as stacked z slices", () => {
    const world = litWorld();
    world.place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    world.place({ x: 3, y: 0, z: 0 }, STONE_ID);
    world.field.update();

    const texture = texturesOf(world).resolveLightTexture(kOrigin);

    assert.ok(texture instanceof THREE.Data3DTexture);
    assert.equal(texture.image.width, kSpan);
    assert.equal(texture.image.height, kSpan);
    assert.equal(texture.image.depth, kSpan);
    assert.deepEqual(texelAt(texture, 2, 1, 1), [210, 210, 210, 255]);
    assert.deepEqual(texelAt(texture, 4, 1, 1), [0, 0, 0, 0]);
    assert.deepEqual(texelAt(texture, 0, 1, 1), [210, 210, 210, 255]);
    assert.deepEqual(texelAt(texture, 1, 1, 1), [0, 0, 0, 0]);
  });

  it("refills the same texture and frees it once the light is gone", () => {
    const world = litWorld();
    const { field, place, remove } = world;
    const textures = texturesOf(world);
    place({ x: 0, y: 0, z: 0 }, GLOW_ID);
    field.update();
    const texture = textures.resolveLightTexture(kOrigin);
    const version = texture?.version ?? 0;

    place({ x: 5, y: 0, z: 0 }, STONE_ID);
    const changed = field.update();
    assert.ok(textures.affects(kOrigin, changed));
    assert.equal(textures.rebuild(kOrigin), texture);
    assert.ok((texture?.version ?? 0) > version);

    remove({ x: 0, y: 0, z: 0 });
    field.update();
    assert.equal(textures.rebuild(kOrigin), null);
    assert.equal(textures.size, 0);
  });

  it("includes the apron when matching changed chunks", () => {
    const textures = texturesOf(litWorld());

    assert.ok(textures.affects(kOrigin, new Set([lightChunkKey(-1, 0, 0)])));
    assert.ok(textures.affects(kOrigin, new Set([lightChunkKey(1, 1, 1)])));
    assert.equal(
      textures.affects(kOrigin, new Set([lightChunkKey(2, 0, 0)])),
      false
    );
  });
});
