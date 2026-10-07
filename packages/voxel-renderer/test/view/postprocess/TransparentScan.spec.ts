// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { TransparentScan } from "../../../src/view/postprocess/TransparentScan.ts";

function meshOf(
  material: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

describe("TransparentScan", () => {
  it("finds a visible transparent material anywhere in the tree", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(meshOf(new THREE.MeshBasicMaterial({ transparent: true })));
    scene.add(meshOf(new THREE.MeshBasicMaterial()), group);

    assert.equal(new TransparentScan().foundIn(scene), true);
  });

  it("finds a transparent entry of a material array", () => {
    const scene = new THREE.Scene();
    scene.add(meshOf([
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial({ transparent: true })
    ]));

    assert.equal(new TransparentScan().foundIn(scene), true);
  });

  it("ignores opaque materials and hidden subtrees", () => {
    const scene = new THREE.Scene();
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(meshOf(new THREE.MeshBasicMaterial({ transparent: true })));
    scene.add(meshOf(new THREE.MeshBasicMaterial()), hidden);
    const scan = new TransparentScan();

    assert.equal(scan.foundIn(scene), false);
    assert.equal(scan.foundIn(scene), false);
  });
});
