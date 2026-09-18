// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SceneLighting,
  type SceneLightingOutput
} from "../../src/scene/SceneLighting.ts";

// CONSTANTS
const kTolerance = 0.02;

function lambertFactor(
  lighting: SceneLighting,
  normal: THREE.Vector3
): number {
  const direction = lighting.directional.position.clone().normalize();
  const facing = Math.max(0, direction.dot(normal));

  return (
    lighting.ambient.intensity +
    (lighting.directional.intensity * facing)
  ) / Math.PI;
}

function createOutput(): SceneLightingOutput {
  return {
    toneMapping: THREE.NeutralToneMapping,
    toneMappingExposure: 1.25
  };
}

describe("SceneLighting", () => {
  test("lit mode shows the brightest face at its authored colour", () => {
    const lighting = new SceneLighting();

    const top = lambertFactor(lighting, new THREE.Vector3(0, 1, 0));
    const side = lambertFactor(lighting, new THREE.Vector3(0, 0, 1));
    const shadowed = lambertFactor(lighting, new THREE.Vector3(0, 0, -1));

    assert.equal(lighting.mode, "lit");
    assert.ok(Math.abs(top - 1) < kTolerance, `top face factor ${top}`);
    assert.ok(side < top && side > shadowed);
    assert.ok(shadowed > 0.35, `shadowed face factor ${shadowed}`);
  });

  test("flat mode lights every face at exactly its albedo", () => {
    const lighting = new SceneLighting();
    lighting.mode = "flat";

    for (const normal of [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, -1, 0)
    ]) {
      assert.equal(lambertFactor(lighting, normal), 1);
    }
  });

  test("returning to lit mode restores the rig", () => {
    const lighting = new SceneLighting();
    const ambient = lighting.ambient.intensity;
    const directional = lighting.directional.intensity;

    lighting.mode = "flat";
    lighting.mode = "lit";

    assert.equal(lighting.ambient.intensity, ambient);
    assert.equal(lighting.directional.intensity, directional);
  });

  test("drives the output exposure and tone mapping", () => {
    const output = createOutput();
    const lighting = new SceneLighting(output);

    assert.equal(output.toneMappingExposure, 1);
    assert.equal(output.toneMapping, THREE.NeutralToneMapping);

    lighting.mode = "flat";
    assert.equal(output.toneMapping, THREE.NoToneMapping);

    lighting.mode = "lit";
    assert.equal(output.toneMapping, THREE.NeutralToneMapping);
  });

  test("exposes both lights for a scene", () => {
    const lighting = new SceneLighting();
    const scene = new THREE.Scene();
    scene.add(...lighting.lights);

    assert.deepEqual(scene.children, [
      lighting.ambient,
      lighting.directional
    ]);
  });
});
