// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyUvGeometry } from "#src/mesh-texturing/applyUvGeometry.ts";
import { readEdge, readRegion } from "./regionAttributes.ts";
const kTextureSize: Vec2 = { x: 64, y: 64 };
const kRect = { x: 16, y: 8, width: 16, height: 8 };

function createGeometry(
  baseUv: Float32Array
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(Float32Array.from(baseUv), 2)
  );

  return geometry;
}

describe("applyUvGeometry — region", () => {
  test("bounds the ranged vertices and leaves the others unclamped", () => {
    const geometry = createGeometry(new Float32Array(16));

    applyUvGeometry(
      geometry,
      new Float32Array(16),
      kRect,
      kTextureSize,
      [{ start: 4, count: 4 }]
    );

    assert.deepStrictEqual(readRegion(geometry, 4), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(readRegion(geometry, 7), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(readEdge(geometry, 4), [0, 0, 1]);
    assert.ok(readRegion(geometry, 3)[0] < -1000);
  });

  test("keeps the diagonal of a rotated triangle in texture space", () => {
    const expected = createGeometry(new Float32Array(6));
    const rotated = createGeometry(new Float32Array(6));
    const triangle = {
      shape: "triangle",
      rect: kRect,
      corner: "top-left"
    } as const;

    applyUvGeometry(
      expected,
      new Float32Array(6),
      triangle,
      kTextureSize,
      [{ start: 0, count: 3 }]
    );
    applyUvGeometry(
      rotated,
      new Float32Array(6),
      {
        ...triangle,
        rotation: 1
      },
      kTextureSize,
      [{ start: 0, count: 3 }]
    );

    assert.deepStrictEqual(readEdge(rotated, 0), readEdge(expected, 0));
  });

  test("ignores the rotation of a rect", () => {
    const geometry = createGeometry(new Float32Array(8));

    applyUvGeometry(
      geometry,
      new Float32Array(8),
      {
        ...kRect,
        rotation: 1
      },
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    assert.deepStrictEqual(readRegion(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
  });

  test("clamps a compound region to its bounding rect only", () => {
    const geometry = createGeometry(new Float32Array(8));

    applyUvGeometry(
      geometry,
      new Float32Array(8),
      {
        shape: "compound",
        rect: kRect,
        parts: [{ x: 0, y: 0, width: 1, height: 0.5 }]
      },
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    assert.deepStrictEqual(readRegion(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(readEdge(geometry, 0), [0, 0, 1]);
  });
});
