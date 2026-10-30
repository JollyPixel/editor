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
  type ComponentDefinition,
  type ScenePrefabFile
} from "../../../src/systems/scene/file/index.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import { createSceneAssets } from "../../helpers/scene/sceneAssets.ts";
import {
  createActorFile,
  createComponentFile,
  createSceneFile
} from "../../helpers/scene/sceneFile.ts";

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
  const assets = createSceneAssets(["knight", "mage"]);
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

async function loadKeepInstance() {
  const setup = createModelSetup();
  const [hero] = setup.file.actors;
  const prefabs = {
    find: (sceneId: string) => (sceneId === "keep" ? { actors: [hero] } : null)
  };
  const file = createSceneFile([
    createActorFile("castle", { prefab: { id: "keep", kind: "scene" } })
  ]);
  const scene = new FileScene("level", file, {
    components: setup.components,
    prefabs
  });
  const load = setup.sm.loadScene(scene);
  setup.assets.loader.resolve("knight");
  await load.done;
  setup.sm.beginFrame();

  return { ...setup, scene };
}

describe("Systems.FileScene", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  test("declares the assets of its components", () => {
    const { assets, components, file } = createModelSetup();

    const scene = new FileScene("level", file, { components });

    assert.strictEqual(scene.assets.length, 1);
    assert.ok(scene.assets[0].equals(assets.reference("knight")));
  });

  test("declares and builds the assets of the scenes its prefabs include", async() => {
    const { sm, assets, scene } = await loadKeepInstance();

    const [castle] = sm.tree.children;
    const [hero] = castle.children;
    assert.ok(scene.assets.some((reference) => reference.equals(assets.reference("knight"))));
    assert.strictEqual(hero.getComponent(ModelComponent)!.model, "knight");
  });

  test("declares and builds the asset an instance override puts in a slot", async() => {
    const { sm, assets, components, file } = createModelSetup();
    const kind = assets.reference("mage").type.kind.value;
    const scene = new FileScene("level", createSceneFile([
      createActorFile("castle", {
        prefab: { id: "keep", kind: "scene" },
        overrides: { components: { model: { assets: { model: { id: "mage", kind } } } } }
      })
    ]), {
      components,
      prefabs: {
        find: () => {
          return { actors: file.actors };
        }
      }
    });

    const load = sm.loadScene(scene);
    assets.loader.resolve("mage");
    await load.done;
    sm.beginFrame();

    const [hero] = sm.tree.children[0].children;
    assert.ok(scene.assets.some((reference) => reference.equals(assets.reference("mage"))));
    assert.strictEqual(hero.getComponent(ModelComponent)!.model, "mage");
  });

  test("captures a prefab instance as the actors it expanded", async() => {
    const { scene } = await loadKeepInstance();

    const captured = scene.capture().actors;

    assert.deepEqual(
      captured.map(({ id, parentId, prefab }) => [id, parentId, prefab]),
      [["castle", null, undefined], ["castle/hero", "castle", undefined]]
    );
  });

  test("never includes its own scene through a prefab cycle", async() => {
    const { sm, assets, components, file } = createModelSetup();
    const level = createSceneFile([
      ...file.actors,
      createActorFile("castle", { prefab: { id: "keep", kind: "scene" } })
    ]);
    const scenes = new Map<string, ScenePrefabFile>([
      ["level", level],
      ["keep", { actors: [createActorFile("back", { prefab: { id: "level", kind: "scene" } })] }]
    ]);
    const scene = new FileScene("level", level, {
      components,
      prefabs: { find: (sceneId) => scenes.get(sceneId) ?? null },
      sceneId: "level"
    });

    const load = sm.loadScene(scene);
    assets.loader.resolve("knight");
    await load.done;
    sm.beginFrame();

    const [, castle] = sm.tree.children;
    const [back] = castle.children;
    assert.strictEqual(scene.assets.length, 1);
    assert.deepEqual(back.children, []);
  });

  test("builds its actors with loaded assets once activated", async() => {
    const { sm, assets, components, file } = createModelSetup();
    const scene = new FileScene("level", file, { components });

    const load = sm.loadScene(scene);
    sm.beginFrame();
    assert.strictEqual(sm.tree.children.length, 0);

    assets.loader.resolve("knight");
    await load.done;
    sm.beginFrame();

    const [hero] = sm.tree.children;
    const model = hero.getComponent(ModelComponent)!;
    assert.strictEqual(sm.tree.children.length, 1);
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
