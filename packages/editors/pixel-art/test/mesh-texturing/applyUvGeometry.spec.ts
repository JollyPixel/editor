// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  UVTriangleCorner,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  applyUvGeometry,
  orientUv
} from "#src/mesh-texturing/applyUvGeometry.ts";
import { edgeOf, regionOf } from "./regionAttributes.ts";

// CONSTANTS
const kCanonicalTriangle: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1]
];
const kTextureSize: Vec2 = { x: 64, y: 64 };
const kRect = { x: 16, y: 8, width: 16, height: 8 };

function geometryOf(
  baseUv: Float32Array
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(Float32Array.from(baseUv), 2)
  );

  return geometry;
}

function uvsOf(
  geometry: THREE.BufferGeometry
): number[] {
  return Array.from(geometry.getAttribute("uv").array);
}

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
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 16, y: 32, width: 16, height: 16 }
      },
      kTextureSize,
      [{ start: 0, count: 3 }]
    );

    assert.deepStrictEqual(uvsOf(geometry), [
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
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      { x: 0, y: 0, width: 32, height: 32 },
      kTextureSize,
      [{ start: 2, count: 2 }]
    );

    assert.deepStrictEqual(uvsOf(geometry), [
      0, 0,
      1, 0,
      0.5, 1,
      0, 1
    ]);
  });

  test("flags every written attribute for upload", () => {
    const geometry = geometryOf(new Float32Array(8));

    applyUvGeometry(
      geometry,
      new Float32Array(8),
      kRect,
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    for (const name of ["uv", "uvRegion", "uvEdge"]) {
      const attribute = geometry.getAttribute(name);
      assert.ok(
        attribute instanceof THREE.BufferAttribute && attribute.version > 0,
        name
      );
    }
  });
});

describe("applyUvGeometry — rect", () => {
  test("scales fractional base UVs into the rect, not to its corners", () => {
    // A stair riser samples the bottom half of its tile.
    const baseUv = Float32Array.from([
      0, 0,
      1, 0,
      1, 0.5,
      0, 0.5
    ]);
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      { x: 0, y: 0, width: 16, height: 16 },
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    // v spans [0.75, 1], so 0.5 lands halfway at 0.875.
    assert.deepStrictEqual(uvsOf(geometry), [
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
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      { x: 0, y: 0, width: 32, height: 32 },
      kTextureSize,
      [
        { start: 0, count: 1 },
        { start: 3, count: 1 }
      ]
    );

    assert.deepStrictEqual(uvsOf(geometry), [
      0, 0.5,
      1, 1,
      0.5, 0.5,
      0.5, 0.5
    ]);
  });
});

describe("applyUvGeometry — compound", () => {
  test("maps a compound through its bounds, leaving the base uvs oriented", () => {
    const baseUv = Float32Array.from([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);
    const geometry = geometryOf(new Float32Array(8));

    applyUvGeometry(
      geometry,
      baseUv,
      {
        shape: "compound",
        rect: { x: 0, y: 0, width: 16, height: 16 },
        parts: [
          { x: 0, y: 0.5, width: 1, height: 0.5 },
          { x: 0.5, y: 0, width: 0.5, height: 0.5 }
        ]
      },
      { x: 32, y: 32 },
      [{ start: 0, count: 4 }]
    );

    const uv = geometry.getAttribute("uv");

    assert.deepEqual(
      [uv.getX(0), uv.getY(0)],
      [0, 0.5],
      "a compound is placed by its bounds, exactly like a plain rect"
    );
    assert.deepEqual([uv.getX(2), uv.getY(2)], [0.5, 1]);
  });
});

describe("applyUvGeometry — rotation", () => {
  test("sends the face top edge to the rect right edge on a clockwise turn", () => {
    const baseUv = Float32Array.from([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]);
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      { x: 0, y: 0, width: 16, height: 16, rotation: 1 },
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    assert.deepStrictEqual(uvsOf(geometry), [
      0.25, 1,
      0.25, 0.75,
      0, 1,
      0, 0.75
    ]);
  });

  test("orients a rotated triangle from its original corner", () => {
    const baseUv = Float32Array.from(kCanonicalTriangle.flat());
    const geometry = geometryOf(baseUv);

    applyUvGeometry(
      geometry,
      baseUv,
      {
        shape: "triangle",
        corner: "bottom-left",
        rect: { x: 0, y: 0, width: 64, height: 64 },
        rotation: 1
      },
      kTextureSize,
      [{ start: 0, count: 3 }]
    );

    assert.deepStrictEqual(uvsOf(geometry), [
      0, 1,
      0, 0,
      1, 0
    ]);
  });
});

describe("applyUvGeometry — region", () => {
  test("bounds the ranged vertices and leaves the others unclamped", () => {
    const geometry = geometryOf(new Float32Array(16));

    applyUvGeometry(
      geometry,
      new Float32Array(16),
      kRect,
      kTextureSize,
      [{ start: 4, count: 4 }]
    );

    assert.deepStrictEqual(regionOf(geometry, 4), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(regionOf(geometry, 7), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(edgeOf(geometry, 4), [0, 0, 1]);
    assert.ok(regionOf(geometry, 3)[0] < -1000);
  });

  test("keeps the diagonal of a rotated triangle in texture space", () => {
    const expected = geometryOf(new Float32Array(6));
    const rotated = geometryOf(new Float32Array(6));
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

    assert.deepStrictEqual(edgeOf(rotated, 0), edgeOf(expected, 0));
  });

  test("ignores the rotation of a rect", () => {
    const geometry = geometryOf(new Float32Array(8));

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

    assert.deepStrictEqual(regionOf(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
  });

  test("clamps a compound region to its bounding rect only", () => {
    const geometry = geometryOf(new Float32Array(8));

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

    assert.deepStrictEqual(regionOf(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
    assert.deepStrictEqual(edgeOf(geometry, 0), [0, 0, 1]);
  });
});
