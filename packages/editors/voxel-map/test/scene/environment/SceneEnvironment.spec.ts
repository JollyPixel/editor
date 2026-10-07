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
  const casters = { meshVersion: 0 };
  const lighting = new SceneLighting();
  const environment = new SceneEnvironment({
    renderer,
    scene,
    lighting,
    chunks,
    casters
  });

  return {
    scene,
    environment,
    casters,
    shadow: lighting.directional.shadow,
    apply: (lighting: LightingMode, glow = true) => environment.apply(
      new ViewSettings({ ...ViewSettings.DEFAULT.toJSON(), lighting, glow })
    ),
    applyShadows: () => environment.apply(
      new ViewSettings({ ...ViewSettings.DEFAULT.toJSON(), shadows: true })
    )
  };
}

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(4, 8, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  return camera;
}

describe("SceneEnvironment shadows", () => {
  test("draws the shadow map once, then not while nothing changes", () => {
    const { shadow, applyShadows, environment } = createEnvironment();
    const camera = createCamera();

    applyShadows();
    environment.follow(camera);

    assert.equal(shadow.autoUpdate, false);
    assert.equal(shadow.needsUpdate, true);

    shadow.needsUpdate = false;
    environment.follow(camera);

    assert.equal(shadow.needsUpdate, false);
  });

  test("redraws when the camera moves the shadow anchor", () => {
    const { shadow, applyShadows, environment } = createEnvironment();
    const camera = createCamera();
    applyShadows();
    environment.follow(camera);
    shadow.needsUpdate = false;

    camera.position.x += 4;
    camera.updateMatrixWorld();
    environment.follow(camera);

    assert.equal(shadow.needsUpdate, true);
  });

  test("redraws when the casters' meshes change", () => {
    const { shadow, applyShadows, environment, casters } = createEnvironment();
    const camera = createCamera();
    applyShadows();
    environment.follow(camera);
    shadow.needsUpdate = false;

    casters.meshVersion++;
    environment.follow(camera);

    assert.equal(shadow.needsUpdate, true);
  });

  test("redraws after an explicit invalidation", () => {
    const { shadow, applyShadows, environment } = createEnvironment();
    const camera = createCamera();
    applyShadows();
    environment.follow(camera);
    shadow.needsUpdate = false;

    environment.invalidateShadows();
    environment.follow(camera);

    assert.equal(shadow.needsUpdate, true);
  });
});

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
