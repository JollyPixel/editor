// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  UVRegion,
  type UVRegion as UVRegionType,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGeometryBinding } from "#src/mesh-texturing/UVGeometryBinding.ts";
import { boxFaceRanges } from "../../page/src/preview/shapes/faceRanges.ts";

// CONSTANTS
const kTextureSize: Vec2 = { x: 64, y: 64 };

function makeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const uvs: number[] = [];
  for (let face = 0; face < 6; face++) {
    uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
  }
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  return geometry;
}

function makeInterleavedGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const buffer = new THREE.InterleavedBuffer(
    new Float32Array([
      10, 20, 0, 1,
      11, 21, 1, 1,
      12, 22, 0, 0,
      13, 23, 1, 0
    ]),
    4
  );
  geometry.setAttribute(
    "uv",
    new THREE.InterleavedBufferAttribute(buffer, 2, 2)
  );

  return geometry;
}

function readUv(
  geometry: THREE.BufferGeometry,
  index: number
): [number, number] {
  const attribute = geometry.getAttribute("uv");

  return [attribute.getX(index), attribute.getY(index)];
}

function stackedRegion(
  rect = { x: 0, y: 0, width: 16, height: 16 }
): UVRegionType {
  return UVRegion.from({
    id: "region-a",
    color: "#ff0000",
    state: "stacked",
    rect
  });
}

describe("UVGeometryBinding", () => {
  let geometry: THREE.BufferGeometry;

  beforeEach(() => {
    geometry = makeGeometry();
  });

  test("projects a stacked region across every vertex on construction", () => {
    new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    assert.deepStrictEqual(readUv(geometry, 0), [0, 1]);
    assert.deepStrictEqual(readUv(geometry, 1), [0.25, 1]);
    assert.deepStrictEqual(readUv(geometry, 2), [0, 0.75]);
    assert.deepStrictEqual(readUv(geometry, 23), [0.25, 0.75]);
  });

  test("preserves the stride and offset of an interleaved UV attribute", () => {
    geometry = makeInterleavedGeometry();

    new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: { front: [{ start: 0, count: 4 }] }
    });

    assert.deepStrictEqual(readUv(geometry, 0), [0, 1]);
    assert.deepStrictEqual(readUv(geometry, 1), [0.25, 1]);
    assert.deepStrictEqual(readUv(geometry, 2), [0, 0.75]);
    assert.deepStrictEqual(readUv(geometry, 3), [0.25, 0.75]);
  });

  test("exposes the bound region id", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    assert.strictEqual(binding.regionId, "region-a");
  });

  test("applyFace rewrites only the named face's vertex range", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.applyFace("top", { x: 32, y: 0, width: 16, height: 16 });

    assert.deepStrictEqual(readUv(geometry, 8), [0.5, 1]);
    assert.deepStrictEqual(readUv(geometry, 9), [0.75, 1]);
    assert.deepStrictEqual(readUv(geometry, 4), [0, 1]);
  });

  test("applyFace ignores a face the geometry has no range for", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: { front: [{ start: 16, count: 4 }] }
    });

    binding.applyFace("top", { x: 32, y: 0, width: 16, height: 16 });

    assert.deepStrictEqual(readUv(geometry, 8), [0, 1]);
  });

  test("resizeTexture reprojects the region against the new size", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.resizeTexture({ x: 32, y: 32 });

    assert.deepStrictEqual(readUv(geometry, 1), [0.5, 1]);
    assert.deepStrictEqual(readUv(geometry, 2), [0, 0.5]);
  });

  test("bindRegion rebinds to another region", () => {
    const binding = new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });

    binding.bindRegion(UVRegion.from({
      id: "region-b",
      color: "#00ff00",
      state: "stacked",
      rect: { x: 0, y: 32, width: 16, height: 16 }
    }));

    assert.strictEqual(binding.regionId, "region-b");
    assert.deepStrictEqual(readUv(geometry, 0), [0, 0.5]);
  });
});
