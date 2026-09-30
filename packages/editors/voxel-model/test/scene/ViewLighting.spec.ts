// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ViewLighting } from "#src/scene/ViewLighting.ts";
import { ViewSettingsStore } from "#src/state/index.ts";

function createHarness() {
  const scene = new THREE.Scene();
  const view = new ViewSettingsStore();
  const lighting = new ViewLighting({
    scene,
    view
  });

  return {
    scene,
    view,
    lighting
  };
}

describe("ViewLighting", () => {
  test("adds its lights to the scene and removes them on dispose", () => {
    const { scene, lighting } = createHarness();

    assert.ok(scene.children.includes(lighting.key));

    lighting.dispose();

    assert.equal(scene.children.includes(lighting.key), false);
  });

  test("moves the key light and scales every light with the exposure", () => {
    const { view, lighting } = createHarness();
    const keyIntensity = lighting.key.intensity;

    view.update({ keyLight: "front-left", exposure: 2 });

    assert.ok(lighting.key.position.x < 0);
    assert.ok(lighting.fill.position.x > 0);
    assert.equal(lighting.key.intensity, keyIntensity * 2);
  });

  test("reflects the environment map only while the environment is on", async() => {
    const { scene, view, lighting } = createHarness();
    const map = new THREE.Texture();

    await lighting.useEnvironment(Promise.resolve(map));
    assert.ok(scene.environment === map);

    view.update({ environment: false });
    assert.ok(scene.environment === null);
  });

  test("disposes an environment map that arrives after the lighting is gone", async() => {
    const { scene, lighting } = createHarness();
    const map = new THREE.Texture();
    let disposed = false;
    map.addEventListener("dispose", () => {
      disposed = true;
    });
    const pending = Promise.withResolvers<THREE.Texture>();
    const using = lighting.useEnvironment(pending.promise);

    lighting.dispose();
    pending.resolve(map);
    await using;

    assert.equal(scene.environment, null);
    assert.equal(disposed, true);
  });
});
