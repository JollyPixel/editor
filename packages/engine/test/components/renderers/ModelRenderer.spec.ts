// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ThreeSceneGraph } from "../../../src/three/scene/ThreeSceneGraph.ts";
import { Actor } from "../../../src/core/actor/index.ts";
import { ModelRenderer } from "../../../src/three/components/renderers/model/ModelRenderer.ts";
import {
  ModelAssetType,
  type Model
} from "../../../src/three/assets/model.ts";
import { SceneManager } from "../../../src/core/systems/scene/SceneManager.ts";

function createWorld(
  model: Model
) {
  return {
    sceneManager: new SceneManager(new ThreeSceneGraph()),
    assetCoordinator: {
      get: () => model
    }
  };
}

function createModel(): Model {
  const object = new THREE.Group();
  object.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));

  return { object, animations: [] };
}

describe("Components.Renderers.ModelRenderer", () => {
  const reference = new AssetReference("model", ModelAssetType);

  test("should give every actor its own copy of the model", () => {
    const model = createModel();
    const world = createWorld(model);
    const first = new Actor(world as any, { name: "first" })
      .addComponentAndGet(ModelRenderer, { asset: reference });
    const second = new Actor(world as any, { name: "second" })
      .addComponentAndGet(ModelRenderer, { asset: reference });

    first.awake();
    second.awake();

    assert.notStrictEqual(first.group, model.object);
    assert.notStrictEqual(first.group, second.group);
    assert.strictEqual(first.group.parent, first.actor.node.object3D);
    assert.strictEqual(second.group.parent, second.actor.node.object3D);
    assert.strictEqual(model.object.parent, null);
  });

  test("should override only the shadow flags its options set", () => {
    const model = createModel();
    const [loaded] = model.object.children as THREE.Mesh[];
    loaded.castShadow = true;
    loaded.receiveShadow = true;
    const renderer = new Actor({ sceneManager: new SceneManager(new ThreeSceneGraph()) } as any, {
      name: "lit"
    }).addComponentAndGet(ModelRenderer, {
      model,
      castShadow: false
    });

    renderer.awake();

    const [mesh] = renderer.group.children as THREE.Mesh[];
    assert.deepEqual(
      [mesh.castShadow, mesh.receiveShadow],
      [false, true]
    );
    assert.notStrictEqual(renderer.group, model.object);
  });

  test("should keep the shared geometry alive when its actor is destroyed", () => {
    const model = createModel();
    const mesh = model.object.children[0] as THREE.Mesh;
    const dispose = mock.method(mesh.geometry, "dispose");
    const world = createWorld(model);
    const actor = new Actor(world as any, { name: "owner" });
    actor.addComponent(ModelRenderer, { asset: reference });
    actor.awake();

    actor.destroy();

    assert.strictEqual(dispose.mock.callCount(), 0);
  });

  test("should not request updates without animations", () => {
    const world = createWorld(createModel());
    const actor = new Actor(world as any, { name: "static" });
    const renderer = actor.addComponentAndGet(ModelRenderer, { asset: reference });

    assert.strictEqual(renderer.needUpdate, false);
    assert.strictEqual(actor.components.updating, false);
  });

  test("should request updates only while a clip plays", () => {
    const model = createModel();
    model.animations.push(new THREE.AnimationClip("spin", 1, [
      new THREE.NumberKeyframeTrack(".rotation[y]", [0, 1], [0, Math.PI])
    ]));
    const actor = new Actor(createWorld(model) as any, { name: "animated" });
    const renderer = actor.addComponentAndGet(ModelRenderer, {
      asset: reference,
      animations: {}
    });
    actor.awake();
    const idle = renderer.needUpdate;

    renderer.animation.play("spin", { fadeInDuration: 0, loop: false });
    const playing = renderer.needUpdate;
    renderer.update(0.5);
    const midway = renderer.needUpdate;
    renderer.update(0.6);

    assert.deepEqual(
      [idle, playing, midway, renderer.needUpdate],
      [false, true, true, false]
    );
    assert.strictEqual(renderer.animation.state, "stopped");
  });
});
