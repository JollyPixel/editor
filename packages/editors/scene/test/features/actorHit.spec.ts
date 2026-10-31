// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { pivotPoint } from "../../src/features/viewport/actorHit.ts";

interface BoxCase {
  position: THREE.Vector3Like;
  actor: boolean;
  visible?: boolean;
}

function aimedPivot(
  boxes: BoxCase[],
  pitch: number
): THREE.Vector3 {
  const scene = new THREE.Scene();
  const actors = new Set<THREE.Object3D>();
  for (const { position, actor, visible = true } of boxes) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    box.position.set(position.x, position.y, position.z);
    box.visible = visible;
    scene.add(box);
    if (actor) {
      actors.add(box);
    }
  }
  scene.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 10, 0);
  camera.rotation.set(pitch, 0, 0);
  camera.updateMatrixWorld(true);
  const aimed = new THREE.Raycaster();
  aimed.setFromCamera(new THREE.Vector2(0, 0), camera);

  return pivotPoint(aimed, scene, {
    findActorId: (object) => (actors.has(object) ? "crate" : null)
  });
}

describe("pivotPoint", () => {
  const cases = [
    {
      title: "the surface of the first actor under the pointer",
      boxes: [
        { position: { x: 0, y: 0, z: 0 }, actor: true },
        { position: { x: 0, y: 5, z: 0 }, actor: false }
      ],
      pitch: -Math.PI / 2,
      expected: { x: 0, y: 1, z: 0 }
    },
    {
      title: "the ground behind a hidden actor",
      boxes: [
        { position: { x: 0, y: 0, z: 0 }, actor: true, visible: false }
      ],
      pitch: -Math.PI / 2,
      expected: { x: 0, y: 0, z: 0 }
    },
    {
      title: "a point ahead when the actor and the ground are out of reach",
      boxes: [
        { position: { x: 0, y: 10, z: -150 }, actor: true }
      ],
      pitch: 0,
      expected: { x: 0, y: 10, z: -10 }
    }
  ];
  for (const { title, boxes, pitch, expected } of cases) {
    test(`pivots on ${title}`, () => {
      const pivot = aimedPivot(boxes, pitch);

      for (const axis of ["x", "y", "z"] as const) {
        assert.ok(
          Math.abs(pivot[axis] - expected[axis]) < 1e-6,
          `${axis}: ${pivot[axis]} !== ${expected[axis]}`
        );
      }
    });
  }
});
