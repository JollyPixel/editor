// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ModelStats } from "#src/preview/ModelStats.ts";

describe("ModelStats", () => {
  test("counts shared materials and skeleton bones once", () => {
    const material = new THREE.MeshStandardMaterial();
    const skeleton = new THREE.Skeleton([new THREE.Bone(), new THREE.Bone()]);
    const object = new THREE.Group();
    for (let index = 0; index < 2; index++) {
      const mesh = new THREE.SkinnedMesh(new THREE.PlaneGeometry(), material);
      mesh.bind(skeleton);
      object.add(mesh);
    }
    object.add(new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(9), 3)
      ),
      [material, new THREE.MeshBasicMaterial()]
    ));

    const stats = new ModelStats({
      object,
      animations: []
    });

    assert.deepEqual({ ...stats }, {
      meshes: 3,
      vertices: 11,
      triangles: 5,
      materials: 2,
      bones: 2,
      clips: 0
    });
  });
});
