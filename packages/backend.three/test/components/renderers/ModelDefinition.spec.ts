// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { Actor, Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { Model } from "../../../src/assets/model.ts";
import type { Shader } from "../../../src/assets/shader.ts";
import { ModelDefinition } from "../../../src/components/renderers/model/ModelDefinition.ts";
import { createThreeSceneSetup } from "../../helpers/scene/threeSceneSetup.ts";

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
  mode: Systems.SceneMode,
  data: Systems.JSONObject,
  model: Model | null = spinningModel(),
  shader: Shader | null = null
) {
  const actor = new Actor(createThreeSceneSetup().world as any, {
    name: "model"
  });
  const definition = new ModelDefinition();
  const renderer = definition.create(actor, definition.parse(data), {
    mode,
    assets: new Systems.ComponentAssets(definition.assets, {
      model: kModelReference,
      shader: shader === null ? null : { kind: "shader", id: "shader-1" }
    }, {
      resolve: <TValue>(reference: AssetReferenceData): TValue | null => (
        reference.kind === "shader" ? shader : model
      ) as TValue | null
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

describe("Components.ModelDefinition shader slot", () => {
  test("renders every mesh with one shader material, disposed with the component", () => {
    const material = new THREE.MeshBasicMaterial();
    let disposed = false;
    material.addEventListener("dispose", () => {
      disposed = true;
    });
    const model = spinningModel();
    model.object.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    const renderer = createModel("edit", {}, model, {
      uniforms: {},
      createMaterial: () => {
        return {
          material,
          animated: false,
          assign: () => undefined
        };
      }
    })!;

    const materials = new Set<THREE.Material | THREE.Material[]>();
    renderer.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        materials.add(child.material);
      }
    });
    renderer.destroy();

    assert.deepEqual([...materials], [material]);
    assert.strictEqual(disposed, true);
  });

  test("keeps frames alive while an animated shader material lives", () => {
    const renderer = createModel("edit", {}, spinningModel(), {
      uniforms: {},
      createMaterial: () => {
        return {
          material: new THREE.MeshBasicMaterial(),
          animated: true,
          assign: () => undefined
        };
      }
    })!;
    const { keepAlives } = renderer.actor.world as unknown as {
      keepAlives: ReadonlySet<() => boolean>;
    };

    assert.deepEqual([...keepAlives].map((keepAlive) => keepAlive()), [true]);

    renderer.destroy();
    assert.strictEqual(keepAlives.size, 0);
  });
});
