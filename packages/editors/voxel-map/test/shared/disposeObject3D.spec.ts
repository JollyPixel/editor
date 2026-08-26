// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { disposeObject3D } from "../../src/shared/disposeObject3D.ts";

describe("disposeObject3D", () => {
  it("disposes shared geometry and material once across a group", () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(geometry, material),
      new THREE.Mesh(geometry, material)
    );

    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => geometryDisposals++);
    material.addEventListener("dispose", () => materialDisposals++);

    disposeObject3D(group);

    assert.equal(geometryDisposals, 1);
    assert.equal(materialDisposals, 1);
  });
});
