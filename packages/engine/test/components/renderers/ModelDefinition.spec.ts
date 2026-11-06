// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import type { Model } from "../../../src/assets/model.ts";
import { ModelDefinition } from "../../../src/components/renderers/model/ModelDefinition.ts";
import {
  ComponentAssets,
  type SceneMode
} from "../../../src/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../src/systems/scene/file/SceneFile.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";

// CONSTANTS
const kModelReference: AssetReferenceData = {
  kind: "model",
  id: "model-1"
};

function spinningModel(): Model {
  const object = new THREE.Group();
  object.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));

  return {
    object,
    animations: [
      new THREE.AnimationClip("spin", 1, [
        new THREE.NumberKeyframeTrack(".rotation[y]", [0, 1], [0, Math.PI])
      ])
    ]
  };
}

function createModel(
  mode: SceneMode,
  data: JSONObject,
  model: Model | null = spinningModel()
) {
  const actor = new Actor({ sceneManager: new SceneManager() } as any, {
    name: "model"
  });
  const definition = new ModelDefinition();
  const renderer = definition.create(actor, definition.parse(data), {
    mode,
    assets: new ComponentAssets(definition.assets, { model: kModelReference }, {
      resolve: <TValue>(): TValue | null => model as TValue | null
    })
  });
  renderer?.awake();
  renderer?.start();
  renderer?.update(0);

  return renderer;
}

describe("Components.ModelDefinition", () => {
  test("builds no component while the model is not available", () => {
    assert.equal(createModel("play", {}, null), null);
  });

  test("plays the chosen clip in play mode", () => {
    const renderer = createModel("play", { animation: "spin" });

    assert.equal(renderer?.animation.currentName, "spin");
  });

  test("keeps the rest pose in edit mode", () => {
    const renderer = createModel("edit", { animation: "spin" });

    assert.equal(renderer?.animation.currentName, null);
  });

  test("plays nothing when the model has no clip of that name", () => {
    const renderer = createModel("play", { animation: "walk" });

    assert.equal(renderer?.animation.currentName, null);
  });
});
