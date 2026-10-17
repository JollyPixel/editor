// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BrushAimResolver } from "../../../../src/features/painting/interaction/BrushAimResolver.ts";
import { CellFace } from "../../../../src/features/painting/model/CellFace.ts";

// CONSTANTS
const kPointer = new THREE.Vector2(0, 0);

describe("BrushAimResolver sky shell", () => {
  function createSkyResolver(
    skyRadius: number,
    place: (camera: THREE.PerspectiveCamera) => void
  ): BrushAimResolver {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    place(camera);
    camera.updateMatrixWorld(true);

    return new BrushAimResolver({
      camera,
      solid: new THREE.Group(),
      groundPlaneSize: 64,
      maxDistance: 32,
      skyRadius
    });
  }

  function lookUp(
    camera: THREE.PerspectiveCamera
  ): void {
    camera.position.set(0.5, 4.5, 0.5);
    camera.lookAt(0.5, 20, 0.5);
  }

  test("catches a ray the ground plane never meets", () => {
    const resolver = createSkyResolver(10, lookUp);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 14, z: 0 },
      remove: { x: 0, y: 14, z: 0 },
      face: null,
      probe: null
    });
  });

  test("leaves the sky alone while the shell is disabled", () => {
    const resolver = createSkyResolver(0, lookUp);

    assert.strictEqual(resolver.resolve(kPointer), null);
  });

  test("keeps the ground for a ray that reaches it", () => {
    const resolver = createSkyResolver(10, (camera) => {
      camera.position.set(0.5, 4, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 0, z: 0 },
      remove: { x: 0, y: 0, z: 0 },
      face: CellFace.NegY,
      probe: null
    });
  });

  test("catches a ground hit that lies out of reach", () => {
    const resolver = createSkyResolver(10, (camera) => {
      camera.position.set(0.5, 40.5, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 30, z: 0 },
      remove: { x: 0, y: 30, z: 0 },
      face: null,
      probe: null
    });
  });

  test("never reaches further than the brush", () => {
    const resolver = createSkyResolver(50, lookUp);

    assert.deepStrictEqual(resolver.resolve(kPointer), {
      place: { x: 0, y: 36, z: 0 },
      remove: { x: 0, y: 36, z: 0 },
      face: null,
      probe: null
    });
  });
});
