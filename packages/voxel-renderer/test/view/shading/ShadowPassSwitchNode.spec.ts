// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { float, vec4 } from "three/tsl";

// Import Internal Dependencies
import {
  shadowPassSwitch
} from "../../../src/view/shading/ShadowPassSwitchNode.ts";

function fakeBuilder(
  material: THREE.Material
): THREE.NodeBuilder {
  return { material } as unknown as THREE.NodeBuilder;
}

describe("ShadowPassSwitchNode", () => {
  it("builds the caster graph only for three's shadow pass material", () => {
    const main = vec4(float(0.5));
    const caster = vec4(float(1));
    const node = shadowPassSwitch(main, caster);
    const light = new THREE.DirectionalLight();
    const shadowMaterial = new THREE.ShadowNode(light, light.shadow)
      .getShadowMaterial();

    assert.equal(node.setup(fakeBuilder(shadowMaterial)), caster);
    assert.equal(node.setup(fakeBuilder(new THREE.MeshLambertMaterial())), main);
  });
});
