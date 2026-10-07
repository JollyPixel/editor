// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SceneLighting,
  type SceneLightingOutput
} from "../../../src/scene/environment/SceneLighting.ts";

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
  test("studio mode shows the brightest face at its authored colour", () => {
    const lighting = new SceneLighting();

    const top = lambertFactor(lighting, new THREE.Vector3(0, 1, 0));
    const side = lambertFactor(lighting, new THREE.Vector3(0, 0, 1));
    const shadowed = lambertFactor(lighting, new THREE.Vector3(0, 0, -1));

    assert.equal(lighting.mode, "studio");
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

  test("returning to studio mode restores the rig", () => {
    const lighting = new SceneLighting();
    const ambient = lighting.ambient.intensity;
    const directional = lighting.directional.intensity;

    lighting.mode = "flat";
    lighting.mode = "studio";

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

    lighting.mode = "studio";
    assert.equal(output.toneMapping, THREE.NeutralToneMapping);
  });

  test("daylight swaps the ambient fill for a sky and a warm sun", () => {
    const output = createOutput();
    const lighting = new SceneLighting(output);

    lighting.mode = "daylight";

    assert.equal(lighting.ambient.intensity, 0);
    assert.ok(lighting.hemisphere.intensity > 0);
    assert.notEqual(lighting.directional.color.getHexString(), "ffffff");
    assert.equal(output.toneMapping, THREE.ACESFilmicToneMapping);
    assert.ok(
      lighting.directional.position.clone().normalize()
        .distanceTo(lighting.sunDirection) < 1e-6
    );
  });

  test("night dims the sky fill and casts a cool moonlight", () => {
    const output = createOutput();
    const lighting = new SceneLighting(output);
    lighting.mode = "daylight";
    const daylightFill = lighting.hemisphere.intensity;
    const daylightSun = lighting.directional.intensity;

    lighting.mode = "night";

    const { r, b } = lighting.directional.color;
    assert.equal(lighting.ambient.intensity, 0);
    assert.ok(lighting.hemisphere.intensity < daylightFill);
    assert.ok(lighting.directional.intensity < daylightSun);
    assert.ok(b > r);
    assert.equal(output.toneMapping, THREE.ACESFilmicToneMapping);
    assert.ok(
      lighting.directional.position.clone().normalize()
        .distanceTo(lighting.sunDirection) < 1e-6
    );
  });

  test("focuses block light at night and lets it wash out shadows", () => {
    const lighting = new SceneLighting();
    lighting.mode = "daylight";

    assert.equal(lighting.rig.blockLightFalloff, "wide");
    assert.equal(lighting.rig.shadowFill, 0);

    lighting.mode = "night";

    assert.equal(lighting.rig.blockLightFalloff, "focused");
    assert.ok(lighting.rig.shadowFill > 0);
  });

  test("restores the daylight sky colours after night", () => {
    const lighting = new SceneLighting();
    lighting.mode = "daylight";
    const sky = lighting.hemisphere.color.getHex();
    const ground = lighting.hemisphere.groundColor.getHex();

    lighting.mode = "night";
    assert.notEqual(lighting.hemisphere.color.getHex(), sky);

    lighting.mode = "daylight";
    assert.equal(lighting.hemisphere.color.getHex(), sky);
    assert.equal(lighting.hemisphere.groundColor.getHex(), ground);
  });

  test("aims the sun at a point along its direction", () => {
    const lighting = new SceneLighting();
    const center = new THREE.Vector3(8, 2, -4);

    lighting.aim(center, 10);

    assert.deepEqual(lighting.directional.target.position, center);
    const offset = lighting.directional.position.clone().sub(center);
    assert.ok(Math.abs(offset.length() - 10) < 1e-6);
    assert.ok(offset.normalize().distanceTo(lighting.sunDirection) < 1e-6);
  });

  test("exposes the lights and the sun target for a scene", () => {
    const lighting = new SceneLighting();
    const scene = new THREE.Scene();
    scene.add(...lighting.lights);

    assert.deepEqual(scene.children, [
      lighting.ambient,
      lighting.hemisphere,
      lighting.directional,
      lighting.directional.target
    ]);
  });
});
