// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/engine";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";

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
  const source = {
    shadowMap: { enabled: false }
  };
  const renderer = {
    getSource: () => source
  } as unknown as Systems.Renderer<THREE.WebGPURenderer>;
  const casters = { meshVersion: 0 };
  const lighting = new SceneLighting();
  const environment = new SceneEnvironment({
    renderer,
    scene,
    lighting,
    chunks,
    casters,
    theme: "dark"
  });

  return {
    scene,
    environment,
    casters,
    chunks,
    sun: lighting.directional,
    shadow: lighting.directional.shadow,
    apply: (lighting: LightingMode, glow = true) => environment.apply(
      new ViewSettings({ ...ViewSettings.DEFAULT.toJSON(), lighting, glow })
    ),
    applyShadows: (shadows = true) => environment.apply(
      new ViewSettings({ ...ViewSettings.DEFAULT.toJSON(), shadows })
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

  test("keeps the sun casting when shadows turn off, only chunks stop", () => {
    const { sun, chunks, applyShadows } = createEnvironment();
    applyShadows(true);

    applyShadows(false);

    assert.equal(sun.castShadow, true);
    assert.equal(chunks.castShadow, false);
    assert.equal(chunks.receiveShadow, false);
  });

  test("redraws the shadow map when shadows turn back on", () => {
    const { shadow, applyShadows, environment } = createEnvironment();
    const camera = createCamera();
    applyShadows(true);
    environment.follow(camera);
    shadow.needsUpdate = false;

    applyShadows(false);
    environment.follow(camera);
    applyShadows(true);
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

    apply("day");
    const day = scene.backgroundNode;
    apply("night");

    assert.notEqual(day, night);
    assert.equal(scene.backgroundNode, night);
  });

  test("draws flat and studio over a studio sky that follows the theme", () => {
    const { scene, apply, environment } = createEnvironment();

    apply("studio");
    const dark = scene.backgroundNode;
    apply("flat");

    assert.ok(dark);
    assert.equal(scene.background, null);
    assert.equal(scene.backgroundNode, dark);

    environment.theme = "light";
    const light = scene.backgroundNode;

    assert.ok(light);
    assert.notEqual(light, dark);

    environment.theme = "dark";

    assert.equal(scene.backgroundNode, dark);
  });

  test("keeps the day and night skies whatever the theme", () => {
    const { scene, apply, environment } = createEnvironment();

    for (const mode of ["day", "night"] as const) {
      apply(mode);
      const sky = scene.backgroundNode;
      environment.theme = "light";

      assert.equal(scene.backgroundNode, sky);

      environment.theme = "dark";
    }
  });

  test("backs the viewport with the sky tone, the theme for studio skies", () => {
    const { apply, environment } = createEnvironment();
    const cases: Array<[LightingMode, ResolvedThemeMode, ResolvedThemeMode]> = [
      ["studio", "dark", "dark"],
      ["studio", "light", "light"],
      ["flat", "dark", "dark"],
      ["flat", "light", "light"],
      ["day", "dark", "light"],
      ["day", "light", "light"],
      ["night", "dark", "dark"],
      ["night", "light", "dark"]
    ];

    for (const [mode, theme, backdrop] of cases) {
      apply(mode);
      environment.theme = theme;

      assert.equal(environment.backdrop, backdrop, `${mode} under ${theme}`);
    }
  });
});
