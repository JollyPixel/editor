// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { color } from "three/tsl";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ThreeSceneEnvironment } from "../../../src/scene/ThreeSceneEnvironment.ts";
import { ThreeSceneGraph } from "../../../src/scene/ThreeSceneGraph.ts";
import { createWorldHarness } from "../../helpers/world/worldHarness.ts";

function createEnvironment() {
  const graph = new ThreeSceneGraph();
  const harness = createWorldHarness();
  const output = {
    toneMapping: THREE.NoToneMapping as THREE.ToneMapping,
    toneMappingExposure: 1
  };
  Object.assign(harness.renderer, { source: output });
  const environment = new ThreeSceneEnvironment(graph, harness.world);

  function apply(
    overrides: Partial<Systems.EnvironmentFile> = {}
  ): Systems.EnvironmentFile {
    const file: Systems.EnvironmentFile = {
      ...Systems.ENVIRONMENT_PRESETS.default,
      reflections: { kind: "none", intensity: 1 },
      ...overrides
    };
    environment.apply(file);

    return file;
  }

  return { graph, environment, output, apply };
}

describe("Systems.ThreeSceneEnvironment", () => {
  test("keeps one glow post-processing while its settings change", () => {
    const { graph, apply } = createEnvironment();

    apply({ glow: { strength: 1, radius: 0.4 } });
    const glow = graph.postProcessing;
    apply({ glow: { strength: 2, radius: 0.1 } });

    assert.strictEqual(typeof glow, "function");
    assert.strictEqual(graph.postProcessing, glow);
  });

  test("draws no glow when the file has none", () => {
    const { graph, apply } = createEnvironment();

    apply({ glow: { strength: 1, radius: 0.4 } });
    apply({ glow: null });

    assert.strictEqual(graph.postProcessing, null);
  });

  test("places the sun from its azimuth toward +X and its elevation", () => {
    const { environment, apply } = createEnvironment();

    apply({
      sun: { color: "#ffffff", intensity: 2, azimuth: 90, elevation: 0 }
    });
    const direction = environment.sun.position.clone().normalize();

    assert.strictEqual(environment.sun.intensity, 2);
    assert.ok(direction.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);
    assert.deepEqual(environment.sun.target.position.toArray(), [0, 0, 0]);
  });

  test("keeps one sky node while the sun moves", () => {
    const { graph, apply } = createEnvironment();
    const { sun } = Systems.ENVIRONMENT_PRESETS.day;
    assert.ok(sun !== null);

    apply({ sky: { kind: "day" }, sun });
    const sky = graph.scene.backgroundNode;
    apply({ sky: { kind: "day" }, sun: { ...sun, azimuth: sun.azimuth + 30 } });

    assert.ok(sky !== null);
    assert.strictEqual(graph.scene.backgroundNode, sky);
  });

  test("draws the fallback sky only while the file has no sky", () => {
    const { graph, environment, apply } = createEnvironment();
    const fallback = color("#123456");

    apply({ sky: { kind: "none" } });
    environment.fallbackSky = fallback;
    assert.strictEqual(graph.scene.backgroundNode, fallback);

    apply({ sky: { kind: "color", color: "#102030" } });
    assert.strictEqual(graph.scene.backgroundNode, null);

    apply({ sky: { kind: "none" } });
    assert.strictEqual(graph.scene.backgroundNode, fallback);
  });

  test("turns the sun off when the file has none", () => {
    const { environment, apply } = createEnvironment();

    apply({ sun: Systems.ENVIRONMENT_PRESETS.day.sun });
    apply({ sun: null });

    assert.strictEqual(environment.sun.intensity, 0);
  });

  test("tone maps the renderer output and restores it when disposed", () => {
    const { environment, output, apply } = createEnvironment();

    apply({ toneMapping: { kind: "aces", exposure: 0.9 } });
    assert.deepEqual(
      [output.toneMapping, output.toneMappingExposure],
      [THREE.ACESFilmicToneMapping, 0.9]
    );

    environment.dispose();
    assert.deepEqual(
      [output.toneMapping, output.toneMappingExposure],
      [THREE.NoToneMapping, 1]
    );
  });

  test("exposes the applied file, sky, fog and glow on the graph until disposed", () => {
    const { graph, environment, apply } = createEnvironment();

    const file = apply({
      sky: { kind: "color", color: "#102030" },
      fog: { kind: "linear", color: "#ffffff", near: 2, far: 40 },
      glow: { strength: 1, radius: 0.4 }
    });
    const fog = graph.scene.fog;
    assert.strictEqual(graph.environment, file);
    assert.strictEqual(
      (graph.scene.background as THREE.Color).getHexString(),
      "102030"
    );
    assert.ok(fog instanceof THREE.Fog);
    assert.deepEqual([fog.near, fog.far], [2, 40]);
    assert.strictEqual(typeof graph.postProcessing, "function");

    environment.dispose();
    assert.strictEqual(graph.environment, null);
    assert.strictEqual(graph.scene.background, null);
    assert.strictEqual(graph.scene.fog, null);
    assert.strictEqual(graph.postProcessing, null);
  });
});
