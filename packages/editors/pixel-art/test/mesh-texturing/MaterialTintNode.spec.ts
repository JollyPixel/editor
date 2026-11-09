// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { MaterialTintNode } from "#src/mesh-texturing/MaterialTintNode.ts";

function fakeBuilder(
  material: THREE.Material
): THREE.NodeBuilder {
  return { material } as unknown as THREE.NodeBuilder;
}

describe("MaterialTintNode", () => {
  test("reads the material color, or white from a colorless material like the shadow pass", () => {
    const tint = new MaterialTintNode();
    const light = new THREE.DirectionalLight();
    const shadowMaterial = new THREE.ShadowNode(light, light.shadow)
      .getShadowMaterial();

    assert.ok(!("color" in shadowMaterial));
    assert.equal(tint.setup(fakeBuilder(shadowMaterial)), tint.colorless);
    assert.equal(tint.setup(fakeBuilder(new THREE.MeshStandardNodeMaterial())), tint.color);
  });
});
