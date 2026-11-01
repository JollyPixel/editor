// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";
import * as THREE from "three";

// Import Internal Dependencies
import { ViewLighting } from "#src/scene/ViewLighting.ts";
import { ViewSettingsStore } from "#src/state/index.ts";

function createHarness() {
  const scene = new THREE.Scene();
  const view = new ViewSettingsStore(new Preferences());
  const environment = new THREE.RenderTarget();
  const lighting = new ViewLighting({
    scene,
    view,
    environment,
    casters: () => []
  });

  return {
    scene,
    view,
    environment,
    lighting
  };
}

describe("ViewLighting", () => {
  test("adds its lights, background and environment to the scene and releases them on dispose", () => {
    const { scene, environment, lighting } = createHarness();
    let released = false;
    environment.addEventListener("dispose", () => {
      released = true;
    });

    assert.ok(scene.children.includes(lighting.key));
    assert.ok(scene.background === lighting.background);
    assert.ok(scene.environment === environment.texture);

    lighting.dispose();

    assert.equal(scene.children.includes(lighting.key), false);
    assert.ok(scene.background === null);
    assert.ok(scene.environment === null);
    assert.ok(released);
  });

  test("darkens the background and dims the key light at night", () => {
    const { view, lighting } = createHarness();
    const litBackground = lighting.background.getHSL({ h: 0, s: 0, l: 0 }).l;
    const litKey = lighting.key.intensity;

    view.update({ lighting: "night" });

    assert.ok(lighting.background.getHSL({ h: 0, s: 0, l: 0 }).l < litBackground);
    assert.ok(lighting.key.intensity < litKey);
  });

  test("paints the scene with the custom background whatever the lighting", () => {
    const { view, lighting } = createHarness();

    view.update({ background: "#123456", lighting: "night" });

    assert.equal(lighting.background.getHexString(), "123456");
  });

  test("warms the key light under a blue sky by day", () => {
    const { view, lighting } = createHarness();

    view.update({ lighting: "day" });

    const { key, background } = lighting;
    assert.ok(key.color.r > key.color.b);
    assert.ok(background.b > background.r && background.b > background.g);
  });

  test("enables key light shadows only while they are on and the view is lit", () => {
    const { view, lighting } = createHarness();
    assert.equal(lighting.shadow.enabled, false);

    view.update({ shadows: true });
    assert.equal(lighting.shadow.enabled, true);

    view.update({ lighting: "flat" });
    assert.equal(lighting.shadow.enabled, false);
  });

  test("moves the key light and puts the fill light opposite it", () => {
    const { view, lighting } = createHarness();

    view.update({ keyLight: "front-left" });

    assert.ok(lighting.key.position.x < 0);
    assert.ok(lighting.fill.position.x > 0);
  });

  test("keeps the environment map attached and silences it while reflections are off", () => {
    const { scene, view, environment } = createHarness();
    assert.ok(scene.environmentIntensity > 0);

    view.update({ reflections: false });

    assert.ok(scene.environment === environment.texture);
    assert.equal(scene.environmentIntensity, 0);
  });
});
