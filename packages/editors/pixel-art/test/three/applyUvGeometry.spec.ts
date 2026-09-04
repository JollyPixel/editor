// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { UVTriangleCorner } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  applyUvGeometry,
  applyUvRect,
  orientUv
} from "#src/three/applyUvGeometry.ts";

// CONSTANTS
const kCanonicalTriangle: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1]
];

describe("orientUv", () => {
  const cases: [UVTriangleCorner, [number, number][]][] = [
    ["bottom-right", [[0, 0], [1, 0], [1, 1]]],
    ["bottom-left", [[1, 0], [0, 0], [0, 1]]],
    ["top-right", [[0, 1], [1, 1], [1, 0]]],
    ["top-left", [[1, 1], [0, 1], [0, 0]]]
  ];

  for (const [corner, expected] of cases) {
    test(`maps the canonical triangle to ${corner}`, () => {
      assert.deepStrictEqual(
        kCanonicalTriangle.map(([u, v]) => orientUv(u, v, corner)),
        expected
      );
    });
  }

  test("leaves rectangular UV coordinates unchanged", () => {
    assert.deepStrictEqual(orientUv(0.25, 0.75, null), [0.25, 0.75]);
  });
});

describe("applyUvGeometry", () => {
  test("projects triangular UVs into texture coordinates", () => {
    const baseUv = Float32Array.from([
      0, 0,
      1, 0,
      1, 1
    ]);
    const attribute = new THREE.Float32BufferAttribute(baseUv, 2);

    applyUvGeometry(
      attribute,
      baseUv,
      {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 16, y: 32, width: 16, height: 16 }
      },
      { x: 64, y: 64 },
      [{ start: 0, count: 3 }]
    );

    assert.deepStrictEqual(Array.from(attribute.array), [
      0.25, 0.25,
      0.5, 0.25,
      0.5, 0.5
    ]);
  });

  test("leaves vertices outside the range untouched", () => {
    const baseUv = Float32Array.from([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);
    const attribute = new THREE.Float32BufferAttribute(
      Float32Array.from(baseUv),
      2
    );

    applyUvGeometry(
      attribute,
      baseUv,
      { x: 0, y: 0, width: 32, height: 32 },
      { x: 64, y: 64 },
      [{ start: 2, count: 2 }]
    );

    assert.deepStrictEqual(Array.from(attribute.array), [
      0, 0,
      1, 0,
      0.5, 1,
      0, 1
    ]);
  });
});

describe("applyUvRect", () => {
  test("scales fractional base UVs into the rect, not to its corners", () => {
    // A stair riser samples the bottom half of its tile.
    const baseUv = Float32Array.from([
      0, 0,
      1, 0,
      1, 0.5,
      0, 0.5
    ]);
    const attribute = new THREE.Float32BufferAttribute(
      Float32Array.from(baseUv),
      2
    );

    applyUvRect({
      uvAttribute: attribute,
      baseUv,
      rect: { x: 0, y: 0, width: 16, height: 16 },
      textureSize: { x: 64, y: 64 },
      ranges: [{ start: 0, count: 4 }]
    });

    // v spans [0.75, 1], so 0.5 lands halfway at 0.875.
    assert.deepStrictEqual(Array.from(attribute.array), [
      0, 0.75,
      0.25, 0.75,
      0.25, 0.875,
      0, 0.875
    ]);
  });

  test("applies every range a face owns", () => {
    const baseUv = Float32Array.from([
      0, 0,
      1, 1,
      0.5, 0.5,
      1, 0
    ]);
    const attribute = new THREE.Float32BufferAttribute(
      Float32Array.from(baseUv),
      2
    );

    applyUvRect({
      uvAttribute: attribute,
      baseUv,
      rect: { x: 0, y: 0, width: 32, height: 32 },
      textureSize: { x: 64, y: 64 },
      ranges: [
        { start: 0, count: 1 },
        { start: 3, count: 1 }
      ]
    });

    assert.deepStrictEqual(Array.from(attribute.array), [
      0, 0.5,
      1, 1,
      0.5, 0.5,
      0.5, 0.5
    ]);
  });
});
