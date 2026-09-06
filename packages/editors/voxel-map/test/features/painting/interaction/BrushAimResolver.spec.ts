// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BrushAimResolver } from "../../../../src/features/painting/interaction/BrushAimResolver.ts";

// CONSTANTS
const kPointer = new THREE.Vector2(0, 0);

interface CellLike {
  x: number;
  y: number;
  z: number;
}

function createResolver(
  blocks: CellLike[],
  place: (camera: THREE.PerspectiveCamera) => void
): BrushAimResolver {
  const solid = new THREE.Group();
  for (const block of blocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    solid.add(mesh);
  }
  solid.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  place(camera);
  camera.updateMatrixWorld(true);

  return new BrushAimResolver({
    camera,
    solid,
    groundPlaneSize: 64,
    maxDistance: 32
  });
}

function aimingDownAtFace(
  camera: THREE.PerspectiveCamera
): void {
  camera.position.set(0.5, 2.2, -3);
  camera.lookAt(0.5, 0.85, 0);
}

describe("BrushAimResolver.aimAtHeight", () => {
  test("falls back to the height row when nothing is in the way", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 3, "place"),
      { x: 0, y: 3, z: 0 }
    );
  });

  test("uses the height row when the surface stands beyond it", () => {
    const resolver = createResolver([{ x: 0, y: 0, z: 0 }], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 4, "place"),
      { x: 0, y: 4, z: 0 }
    );
  });

  test("places against a surface the height row hides behind", () => {
    const resolver = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 0, "place"),
      { x: 0, y: 0, z: -1 }
    );
  });

  test("removes the surface the height row hides behind", () => {
    const resolver = createResolver(
      [{ x: 0, y: 0, z: 0 }],
      aimingDownAtFace
    );

    assert.deepStrictEqual(
      resolver.aimAtHeight(kPointer, 0, "remove"),
      { x: 0, y: 0, z: 0 }
    );
  });

  test("reports nothing beyond the brush reach", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 100, 0.5);
      camera.lookAt(0.5, 0, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0, "place"), null);
  });

  test("reports nothing when the ray never meets the height row", () => {
    const resolver = createResolver([], (camera) => {
      camera.position.set(0.5, 10, 0.5);
      camera.lookAt(20, 10, 0.5);
    });

    assert.strictEqual(resolver.aimAtHeight(kPointer, 0, "place"), null);
  });
});
