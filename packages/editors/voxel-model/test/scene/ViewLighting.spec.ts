// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";
import { Systems } from "@jolly-pixel/ecs";
import { ThreeSceneGraph, type BakedRoomEnvironment } from "@jolly-pixel/backend.three";
import * as THREE from "three/webgpu";
import {
  EnvironmentDocument,
  PreviewEnvironment
} from "@jolly-pixel/asset.environment/client";

// Import Internal Dependencies
import { ViewLighting } from "#src/scene/ViewLighting.ts";
import { ViewSettingsStore } from "#src/state/index.ts";

function createPreview(): PreviewEnvironment {
  const night = new EnvironmentDocument();
  const { version: _version, ...sections } = Systems.ENVIRONMENT_PRESETS.night;
  night.change(sections);

  return new PreviewEnvironment({
    catalog: {
      records: () => [
        { id: "night", kind: "environment", path: "Night.environment.json" }
      ],
      subscribe: () => () => undefined
    },
    open: (assetId) => (
      assetId === "night" ? { document: night, release: () => undefined } : null
    )
  });
}

function createHarness() {
  const graph = new ThreeSceneGraph();
  const { scene } = graph;
  const view = new ViewSettingsStore(new Preferences());
  const environment = new THREE.RenderTarget();
  const world = {
    logger: new Systems.Logger(),
    renderer: {
      source: {
        toneMapping: THREE.NoToneMapping,
        toneMappingExposure: 1
      }
    },
    sceneManager: { graph },
    invalidate: () => undefined
  };
  const room = {
    createRenderTarget: () => environment
  };
  const preview = createPreview();
  const lighting = new ViewLighting({
    world: world as unknown as Systems.World<THREE.WebGPURenderer, any>,
    view,
    room: room as unknown as BakedRoomEnvironment,
    preview,
    casters: () => [],
    theme: "dark"
  });

  return {
    scene,
    preview,
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
    assert.ok(scene.backgroundNode);
    assert.ok(scene.environment === environment.texture);

    lighting.dispose();

    assert.equal(scene.children.includes(lighting.key), false);
    assert.ok(scene.backgroundNode === null);
    assert.ok(scene.environment === null);
    assert.ok(released);
  });

  test("dims the key light at night", () => {
    const { view, lighting } = createHarness();
    const litKey = lighting.key.intensity;

    view.update({ lighting: "night" });

    assert.ok(lighting.key.intensity < litKey);
  });

  test("paints a studio sky that follows the theme and the shared outdoor sky by day", () => {
    const { scene, view, lighting } = createHarness();
    const darkStudio = scene.backgroundNode;

    lighting.theme = "light";
    assert.notEqual(scene.backgroundNode, darkStudio);

    view.update({ lighting: "day" });
    const daySky = scene.backgroundNode;
    assert.notEqual(daySky, darkStudio);
    lighting.theme = "dark";
    view.update({ keyLight: "top" });
    assert.equal(scene.backgroundNode, daySky);
  });

  test("warms the key light by day", () => {
    const { view, lighting } = createHarness();

    view.update({ lighting: "day" });

    assert.ok(lighting.key.color.r > lighting.key.color.b);
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

  test("detaches the environment map while reflections are off", () => {
    const { scene, view, environment } = createHarness();

    view.update({ reflections: false });
    assert.equal(scene.environment, null);

    view.update({ reflections: true });
    assert.ok(scene.environment === environment.texture);
  });

  test("lights the view with a previewed project environment until the preset is chosen again", () => {
    const { scene, preview, view, lighting } = createHarness();
    const studioSky = scene.backgroundNode;

    preview.choose("night");
    assert.notEqual(scene.backgroundNode, studioSky);
    assert.equal(lighting.fill.intensity, 0);

    view.update({ lighting: "day" });
    assert.ok(lighting.key.color.b > lighting.key.color.r);

    preview.choose("");
    assert.ok(lighting.key.color.r > lighting.key.color.b);
  });
});
