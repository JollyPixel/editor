// Import Node.js Dependencies
import { describe, test } from "node:test";
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
import { clampUvRegion } from "#src/mesh-texturing/clampUvRegion.ts";
import type { FaceRanges } from "#src/mesh-texturing/types.ts";
import { readEdge, readRegion } from "./regionAttributes.ts";
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

describe("UVGeometryBinding region attributes", () => {
  function bind(
    geometry: THREE.BufferGeometry,
    faceRanges: FaceRanges = boxFaceRanges()
  ): UVGeometryBinding {
    clampUvRegion(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()));

    return new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges
    });
  }

  test("writes the region before the geometry is clamped", () => {
    const geometry = makeGeometry();

    new UVGeometryBinding({
      geometry,
      region: stackedRegion(),
      textureSize: kTextureSize,
      faceRanges: boxFaceRanges()
    });
    clampUvRegion(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()));

    assert.deepStrictEqual(readRegion(geometry, 0), [0.5, 48.5, 15.5, 63.5]);
  });

  test("writes the region of every face on construction", () => {
    const geometry = makeGeometry();

    bind(geometry);

    assert.deepStrictEqual(readRegion(geometry, 0), [0.5, 48.5, 15.5, 63.5]);
    assert.deepStrictEqual(readRegion(geometry, 23), [0.5, 48.5, 15.5, 63.5]);
  });

  test("follows a face moved with applyFace", () => {
    const geometry = makeGeometry();
    const binding = bind(geometry);

    binding.applyFace("top", { x: 32, y: 0, width: 16, height: 16 });

    assert.deepStrictEqual(readRegion(geometry, 8), [32.5, 48.5, 47.5, 63.5]);
    assert.deepStrictEqual(readRegion(geometry, 4), [0.5, 48.5, 15.5, 63.5]);
  });

  test("follows a whole-region drag preview", () => {
    const geometry = makeGeometry();
    const binding = bind(geometry);

    binding.preview(stackedRegion({ x: 16, y: 16, width: 16, height: 16 }));

    assert.deepStrictEqual(readRegion(geometry, 0), [16.5, 32.5, 31.5, 47.5]);
  });

  test("bounds a whole-region triangle by its rect only", () => {
    const geometry = makeGeometry();
    const binding = bind(geometry);

    binding.applyFace(null, {
      shape: "triangle",
      rect: { x: 16, y: 16, width: 16, height: 16 },
      corner: "top-left"
    });

    assert.deepStrictEqual(readRegion(geometry, 0), [16.5, 32.5, 31.5, 47.5]);
    assert.deepStrictEqual(readEdge(geometry, 0), [0, 0, 1]);
  });

  test("follows a texture resize", () => {
    const geometry = makeGeometry();
    const binding = bind(geometry);

    binding.resizeTexture({ x: 32, y: 32 });

    assert.deepStrictEqual(readRegion(geometry, 0), [0.5, 16.5, 15.5, 31.5]);
  });

  test("writes the diagonal of a triangle face", () => {
    const geometry = makeGeometry();
    const binding = bind(geometry, { left: [{ start: 0, count: 3 }] });

    binding.applyFace("left", {
      shape: "triangle",
      rect: { x: 0, y: 0, width: 16, height: 16 },
      corner: "bottom-left"
    });

    const [nx, ny] = readEdge(geometry, 0);
    assert.ok(Math.hypot(nx, ny) > 0.99);
    assert.deepStrictEqual(readEdge(geometry, 3), [0, 0, 1]);
  });

  for (const rotation of [0, 1, 2, 3] as const) {
    test(`keeps a triangle rotated ${rotation} turns inside its diagonal`, () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2)
      );
      const binding = bind(geometry, { left: [{ start: 0, count: 3 }] });

      binding.applyFace("left", {
        shape: "triangle",
        rect: { x: 16, y: 0, width: 16, height: 16 },
        corner: "top-right",
        rotation
      });

      const [nx, ny, c] = readEdge(geometry, 0);
      for (let index = 0; index < 3; index++) {
        const [u, v] = readUv(geometry, index);
        const distance = (nx * u * kTextureSize.x) +
          (ny * v * kTextureSize.y) - c;
        assert.ok(distance < 0.1, `vertex ${index} is ${distance} texels out`);
      }
    });
  }
});
