// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MODEL_DEFAULTS,
  type Model
} from "@jolly-pixel/engine";
import type { ChoiceRow } from "@jolly-pixel/editor.host/scene";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { modelForm } from "#src/sceneComponents/modelForm.ts";

function animationValues(
  animation: string,
  model: Model | null
): string[] {
  const [row] = modelForm({ ...MODEL_DEFAULTS, animation }, model);

  return (row as ChoiceRow).options.map((option) => option.value);
}

describe("modelForm", () => {
  test("offers no animation and every clip of the model", () => {
    const model: Model = {
      object: new THREE.Group(),
      animations: [
        new THREE.AnimationClip("idle", 1, []),
        new THREE.AnimationClip("walk", 1, [])
      ]
    };

    assert.deepEqual(animationValues("", model), ["", "idle", "walk"]);
  });

  test("keeps the chosen clip while the model is not loaded", () => {
    assert.deepEqual(animationValues("walk", null), ["", "walk"]);
  });
});
