// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyUvGeometry } from "#src/mesh-texturing/applyUvGeometry.ts";
import { clampUvRegion } from "#src/mesh-texturing/clampUvRegion.ts";
import { UV_REGION_ATTRIBUTE } from "#src/mesh-texturing/uvRegion.ts";
import { regionOf } from "./regionAttributes.ts";

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

function clamp(
  geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  clampUvRegion(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()));

  return geometry;
}

describe("clampUvRegion", () => {
  test("adds unclamped region attributes to a geometry", () => {
    const geometry = clamp(makeGeometry(4));

    assert.ok(regionOf(geometry, 3)[0] < -1000);
  });

  test("keeps the attributes and region of a geometry clamped twice", () => {
    const geometry = clamp(makeGeometry(4));
    const region = geometry.getAttribute(UV_REGION_ATTRIBUTE);
    applyUvGeometry(
      geometry,
      new Float32Array(8),
      kRect,
      kTextureSize,
      [{ start: 0, count: 4 }]
    );

    clamp(geometry);

    assert.strictEqual(geometry.getAttribute(UV_REGION_ATTRIBUTE), region);
    assert.deepStrictEqual(regionOf(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
  });

  test("gives the material a colour node that outlives map changes", () => {
    const material = new THREE.MeshBasicNodeMaterial();
    const mesh = new THREE.Mesh(makeGeometry(4), material);

    clampUvRegion(mesh);
    const colorNode = material.colorNode;
    material.map = new THREE.Texture();

    assert.ok(colorNode);
    assert.strictEqual(material.colorNode, colorNode);
  });
});
