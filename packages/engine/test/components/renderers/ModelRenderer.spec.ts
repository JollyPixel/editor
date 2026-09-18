// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import { ModelRenderer } from "../../../src/components/renderers/model/ModelRenderer.ts";
import {
  ModelAssetType,
  type Model
} from "../../../src/assets/model.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";

function createWorld(
  model: Model
) {
  return {
    sceneManager: new SceneManager(),
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
    assert.strictEqual(first.group.parent, first.actor.object3D);
    assert.strictEqual(second.group.parent, second.actor.object3D);
    assert.strictEqual(model.object.parent, null);
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
    assert.deepEqual(actor.componentsRequiringUpdate, []);
  });
});
