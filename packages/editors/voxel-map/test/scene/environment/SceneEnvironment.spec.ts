// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SceneEnvironment,
  type ChunkRendering
} from "../../../src/scene/environment/SceneEnvironment.ts";
import { SceneLighting } from "../../../src/scene/environment/SceneLighting.ts";
import {
  ViewSettings,
  type LightingMode
} from "../../../src/state/ViewSettings.ts";

function createEnvironment() {
  const scene = new THREE.Scene();
  const chunks: ChunkRendering = {
    ambientOcclusion: 0,
    blockLight: 0,
    blockLightFalloff: "wide",
    shadowFill: 0,
    castShadow: false,
    receiveShadow: false
  };
  const renderer = {
    shadowMap: { enabled: false }
  } as unknown as THREE.WebGPURenderer;
  const environment = new SceneEnvironment({
    renderer,
    scene,
    lighting: new SceneLighting(),
    chunks
  });

  return {
    scene,
    apply: (lighting: LightingMode, glow = true) => environment.apply(
      new ViewSettings({ ...ViewSettings.DEFAULT.toJSON(), lighting, glow })
    )
  };
}

describe("SceneEnvironment", () => {
  test("keeps one sky node per lighting mode across settings changes", () => {
    const { scene, apply } = createEnvironment();

    apply("night");
    const night = scene.backgroundNode;
    apply("night", false);

    assert.ok(night);
    assert.equal(scene.backgroundNode, night);

    apply("daylight");
    const daylight = scene.backgroundNode;
    apply("night");

    assert.notEqual(daylight, night);
    assert.equal(scene.backgroundNode, night);
  });

  test("swaps the sky for a plain colour in studio mode", () => {
    const { scene, apply } = createEnvironment();

    apply("daylight");
    apply("studio");

    assert.equal(scene.backgroundNode, null);
    assert.ok(scene.background instanceof THREE.Color);
  });
});
