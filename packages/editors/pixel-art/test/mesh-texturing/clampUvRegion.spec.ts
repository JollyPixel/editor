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
import { readRegion } from "./regionAttributes.ts";

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
  clampUvRegion(new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial()), null);

  return geometry;
}

function clampedMaterial(
  map: THREE.Texture
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();
  clampUvRegion(new THREE.Mesh(makeGeometry(4), material), map);

  return material;
}

describe("clampUvRegion", () => {
  test("adds unclamped region attributes to a geometry", () => {
    const geometry = clamp(makeGeometry(4));

    assert.ok(readRegion(geometry, 3)[0] < -1000);
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
    assert.deepStrictEqual(readRegion(geometry, 0), [16.5, 48.5, 31.5, 55.5]);
  });

  test("gives every material on one map the same shader cache key so meshes share one build", () => {
    const map = new THREE.Texture();
    const first = clampedMaterial(map);
    const second = clampedMaterial(map);

    assert.strictEqual(first.customProgramCacheKey(), second.customProgramCacheKey());
  });

  test("moves the material to the map it is clamped with again", () => {
    const map = new THREE.Texture();
    const onMap = clampedMaterial(map);
    const material = clampedMaterial(new THREE.Texture());
    assert.notStrictEqual(material.customProgramCacheKey(), onMap.customProgramCacheKey());

    clampUvRegion(new THREE.Mesh(makeGeometry(4), material), map);

    assert.strictEqual(material.map, map);
    assert.strictEqual(material.customProgramCacheKey(), onMap.customProgramCacheKey());
  });
});
