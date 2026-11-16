// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  SceneEnvironmentFile
} from "../../../src/core/systems/scene/file/SceneFile.ts";
import { ThreeSceneGraph } from "../../../src/three/scene/ThreeSceneGraph.ts";
import { createWorldHarness } from "../../helpers/world/worldHarness.ts";

function createEnvironment() {
  const graph = new ThreeSceneGraph();
  const environment = graph.createEnvironment(createWorldHarness().world);

  function apply(
    glow: SceneEnvironmentFile["glow"]
  ): void {
    environment.apply({
      background: null,
      environment: { kind: "none", intensity: 1 },
      fog: { kind: "none" },
      glow
    });
  }

  return { graph, apply };
}

describe("Systems.ThreeSceneEnvironment", () => {
  test("keeps one glow post-processing while its settings change", () => {
    const { graph, apply } = createEnvironment();

    apply({ strength: 1, radius: 0.4 });
    const glow = graph.postProcessing;
    apply({ strength: 2, radius: 0.1 });

    assert.strictEqual(typeof glow, "function");
    assert.strictEqual(graph.postProcessing, glow);
  });

  test("draws no glow when the file leaves it out", () => {
    const { graph, apply } = createEnvironment();

    apply({ strength: 1, radius: 0.4 });
    apply(undefined);

    assert.strictEqual(graph.postProcessing, null);
  });
});
