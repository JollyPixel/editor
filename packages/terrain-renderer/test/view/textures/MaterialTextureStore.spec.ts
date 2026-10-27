// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  MATERIAL_MAPS,
  MaterialTextureStore,
  type MaterialArrays,
  type MaterialImage,
  type TextureCopier
} from "#src/view/textures/MaterialTextureStore.ts";

interface Copy {
  source: THREE.Texture;
  destination: THREE.Texture;
  layers: number;
  at: number;
}

function recordingStore() {
  const copies: Copy[] = [];
  const replaced: MaterialArrays[] = [];
  const copier: TextureCopier = {
    copyTextureToTexture(source, destination, region, position) {
      copies.push({
        source,
        destination,
        layers: region === null || region === undefined ? 1 : region.max.z - region.min.z,
        at: position?.z ?? 0
      });
    }
  };
  const store = new MaterialTextureStore({
    copier,
    replaced: (arrays) => replaced.push(arrays)
  });

  return { store, copies, replaced };
}

function image(
  size: number
): MaterialImage {
  return { width: size, height: size };
}

function slotTiling(
  store: MaterialTextureStore,
  slot: number
): number {
  return (store.slots.image.data as Float32Array)[slot * 4 + 1];
}

describe("MaterialTextureStore", () => {
  test("a material takes the lowest free array layer, whatever its slot, and frees it on removal", () => {
    const { store } = recordingStore();
    store.materialChanged(200, { tiling: 4 });
    store.materialChanged(3, { tiling: 2 });
    store.materialRemoved(200);
    store.materialChanged(7, { tiling: 8 });

    assert.deepEqual([store.index(3), store.index(7), store.index(200)], [1, 0, undefined]);
    assert.equal(slotTiling(store, 7), 8);
  });

  test("an image is copied into its material's array layer, and a null image falls back", () => {
    const { store, copies } = recordingStore();
    store.materialChanged(0, { tiling: 4 });
    store.materialChanged(5, { tiling: 4 });
    const albedo = image(store.size);

    store.writeMap(5, "albedo", albedo);
    store.writeMap(5, "height", image(store.size));
    store.writeMap(5, "orm", image(store.size));
    store.writeMap(5, "orm", null);

    assert.deepEqual(copies.map(({ destination, at }) => [destination, at]), [
      [store.arrays.albedo, 1],
      [store.arrays.height, 1],
      [store.arrays.orm, 1]
    ]);
    assert.equal(copies[0].source.image, albedo);
    const marked = MATERIAL_MAPS.map((map) => store.hasMap(5, map));
    assert.deepEqual(marked, [true, false, false, true]);
    assert.equal(store.hasMap(0, "albedo"), false);
  });

  test("an image of another size or for an empty slot is refused", () => {
    const { store } = recordingStore();
    store.materialChanged(0, { tiling: 4 });

    assert.throws(() => store.writeMap(0, "albedo", image(store.size / 2)), RangeError);
    assert.throws(() => store.writeMap(1, "albedo", image(store.size)), RangeError);
  });

  test("past its capacity, the store moves every material into larger arrays", () => {
    const { store, copies, replaced } = recordingStore();
    const capacity = store.capacity;
    const previous = store.arrays;
    for (let slot = 0; slot <= capacity; slot++) {
      store.materialChanged(slot, { tiling: 4 });
    }

    assert.equal(store.capacity, capacity * 2);
    assert.deepEqual(replaced, [store.arrays]);
    assert.deepEqual(
      copies.map(({ source, destination, layers }) => [source, destination, layers]),
      MATERIAL_MAPS.map((map) => [previous[map], store.arrays[map], capacity])
    );
    assert.equal(store.index(capacity), capacity);
  });

  test("a new texture size replaces the arrays empty, so every map must be written again", () => {
    const { store, copies, replaced } = recordingStore();
    store.materialChanged(0, { tiling: 4 });
    store.writeMap(0, "albedo", image(store.size));
    copies.length = 0;

    store.resize(512);

    assert.equal(store.arrays.albedo.image.width, 512);
    assert.deepEqual(replaced, [store.arrays]);
    assert.deepEqual(copies, []);
    assert.equal(store.hasMap(0, "albedo"), false);
    assert.equal(store.index(0), 0);
  });
});
