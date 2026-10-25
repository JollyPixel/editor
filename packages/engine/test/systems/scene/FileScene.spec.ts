// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import { Scene } from "../../../src/systems/scene/Scene.ts";
import {
  ComponentDefinitions,
  FileScene,
  type ComponentDefinition
} from "../../../src/systems/scene/file/index.ts";
import { createSceneSetup } from "../../helpers/sceneSetup.ts";
import { createSceneAssets } from "../../sceneAssets.ts";
import {
  createActorFile,
  createComponentFile,
  createSceneFile
} from "../../helpers/sceneFile.ts";

class ModelComponent extends ActorComponent {
  readonly model: string | null;

  constructor(
    actor: Actor,
    options: { model: string | null; }
  ) {
    super({ actor, typeName: "Model" });
    this.model = options.model;
  }
}

function createModelSetup() {
  const assets = createSceneAssets(["knight"]);
  const { type } = assets.reference("knight");
  const definition: ComponentDefinition<null, ModelComponent, { model: string; }> = {
    type: "Model",
    assets: { model: type },
    parse: () => null,
    create: (actor, _data, context) => actor.addComponentAndGet(ModelComponent, {
      model: context.assets.resolve("model")
    })
  };
  const components = new ComponentDefinitions().register(definition);
  const file = createSceneFile(
    [
      createActorFile("hero", {
        components: [
          createComponentFile("model", "Model", {}, { model: { id: "knight", kind: type.kind.value } })
        ]
      })
    ],
    {
      background: "#ff0000",
      fog: { kind: "linear", color: "#ffffff", near: 2, far: 40 }
    }
  );

  return { ...createSceneSetup(assets), assets, components, file };
}

describe("Systems.FileScene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  test("declares the assets of its components", () => {
    const { assets, components, file } = createModelSetup();

    const scene = new FileScene("level", file, { components });

    assert.strictEqual(scene.assets.length, 1);
    assert.ok(scene.assets[0].equals(assets.reference("knight")));
  });

  test("builds its actors with loaded assets once activated", async() => {
    const { sm, assets, components, file } = createModelSetup();
    const scene = new FileScene("level", file, { components });

    const load = sm.loadScene(scene);
    sm.beginFrame();
    assert.strictEqual(scene.build, null);

    assets.loader.resolve("knight");
    await load.done;
    sm.beginFrame();

    const hero = scene.build!.actor("hero")!;
    const model = scene.build!.component("model") as ModelComponent;
    assert.deepEqual(sm.tree.children, [hero]);
    assert.strictEqual(model.actor, hero);
    assert.strictEqual(model.model, "knight");
  });

  test("applies its environment and resets it when unloaded", async() => {
    const { sm, assets, components, file } = createModelSetup();
    const scene = new FileScene("level", file, { components });
    const load = sm.loadScene(scene);
    assets.loader.resolve("knight");
    await load.done;
    sm.beginFrame();

    const background = sm.default.background;
    const fog = sm.default.fog;
    assert.ok(background instanceof THREE.Color);
    assert.strictEqual(background.getHexString(), "ff0000");
    assert.ok(fog instanceof THREE.Fog);
    assert.deepEqual([fog.near, fog.far], [2, 40]);

    sm.unloadScene(scene);

    assert.strictEqual(sm.default.background, null);
    assert.strictEqual(sm.default.fog, null);
  });
});
