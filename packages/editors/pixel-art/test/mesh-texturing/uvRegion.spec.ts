// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  UVTriangleCorner,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  diagonalHalfPlane,
  ensureUvRegionAttributes,
  texelBounds,
  type HalfPlane
} from "#src/mesh-texturing/uvRegion.ts";
import { edgeOf, regionOf } from "./regionAttributes.ts";

// CONSTANTS
const kTextureSize: Vec2 = { x: 64, y: 64 };
const kRect = { x: 16, y: 8, width: 16, height: 8 };

function makeGeometry(
  vertexCount: number
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(new Float32Array(vertexCount * 2), 2)
  );

  return geometry;
}

/*
 * Signed distance, in texels, of a rect-local point (y down) to the
 * half-plane: negative inside the triangle.
 */
function edgeDistance(
  [nx, ny, c]: HalfPlane,
  localX: number,
  localY: number
): number {
  const x = kRect.x + (localX * kRect.width);
  const y = kTextureSize.y - (kRect.y + (localY * kRect.height));

  return (nx * x) + (ny * y) - c;
}

describe("ensureUvRegionAttributes", () => {
  test("adds unclamped region and edge attributes sized to the uv attribute", () => {
    const geometry = makeGeometry(4);

    const { region, edge } = ensureUvRegionAttributes(geometry);

    assert.strictEqual(region.count, 4);
    assert.strictEqual(edge.count, 4);
    const [minX, minY, maxX, maxY] = regionOf(geometry, 3);
    assert.ok(minX < -1000 && minY < -1000);
    assert.ok(maxX > 1000 && maxY > 1000);
    assert.deepStrictEqual(edgeOf(geometry, 3), [0, 0, 1]);
  });

  test("returns the attributes a geometry already has", () => {
    const geometry = makeGeometry(4);
    const first = ensureUvRegionAttributes(geometry);

    const second = ensureUvRegionAttributes(geometry);

    assert.strictEqual(second.region, first.region);
    assert.strictEqual(second.edge, first.edge);
  });
});

describe("texelBounds", () => {
  test("bounds a rect between its first and last texel centres, v up", () => {
    assert.deepStrictEqual(
      texelBounds(kRect, kTextureSize),
      [16.5, 48.5, 31.5, 55.5]
    );
  });

  test("collapses a sub-texel rect onto its first texel centre", () => {
    assert.deepStrictEqual(
      texelBounds({ x: 4, y: 4, width: 0.5, height: 0.5 }, kTextureSize),
      [4.5, 60, 4.5, 60]
    );
  });
});

describe("diagonalHalfPlane", () => {
  test("has no edge without a corner", () => {
    assert.deepStrictEqual(
      diagonalHalfPlane(kRect, null, kTextureSize),
      [0, 0, 1]
    );
  });

  const kCornerCases: [UVTriangleCorner, inside: [number, number], outside: [number, number]][] = [
    ["top-left", [0.2, 0.2], [0.8, 0.8]],
    ["top-right", [0.8, 0.2], [0.2, 0.8]],
    ["bottom-left", [0.2, 0.8], [0.8, 0.2]],
    ["bottom-right", [0.8, 0.8], [0.2, 0.2]]
  ];

  for (const [corner, inside, outside] of kCornerCases) {
    test(`keeps the ${corner} half of a triangle on the inner side of its diagonal`, () => {
      const halfPlane = diagonalHalfPlane(kRect, corner, kTextureSize);

      assert.ok(edgeDistance(halfPlane, ...inside) < 0);
      assert.ok(edgeDistance(halfPlane, ...outside) > 0);
    });
  }

  test("insets the diagonal by a fraction of a texel", () => {
    const halfPlane = diagonalHalfPlane(kRect, "top-left", kTextureSize);

    const onDiagonal = edgeDistance(halfPlane, 0.5, 0.5);
    assert.ok(onDiagonal > 0 && onDiagonal < 0.5);
  });
});
