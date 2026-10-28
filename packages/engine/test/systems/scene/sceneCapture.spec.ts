// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import { Scene } from "../../../src/systems/scene/Scene.ts";
import {
  ComponentDefinitions,
  FileScene,
  type ComponentDefinition,
  type SceneFile
} from "../../../src/systems/scene/file/index.ts";
import {
  Behavior,
  MeshDefinition,
  MeshRenderer,
  SceneProperty,
  ScriptDefinition
} from "../../../src/components/index.ts";
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

class Patrol extends Behavior {
  speed = 1;
  target: Actor | null = null;
}
SceneProperty({ type: "number" })(Patrol.prototype, "speed");
SceneProperty({ type: "Actor" })(Patrol.prototype, "target");

function createLevel() {
  const assets = createSceneAssets(["knight"]);
  const { type } = assets.reference("knight");
  const model: ComponentDefinition<string, ModelComponent, { model: string; }> = {
    type: "Model",
    assets: { model: type },
    parse: (data) => (typeof data.skin === "string" ? data.skin : "plain"),
    create: (actor, _skin, context) => actor.addComponentAndGet(ModelComponent, {
      model: context.assets.resolve("model")
    })
  };
  const components = new ComponentDefinitions().register(
    model,
    new MeshDefinition(),
    new ScriptDefinition({ Patrol })
  );
  const knight = { id: "knight", kind: type.kind.value };
  const file = createSceneFile([
    createActorFile("hero", {
      components: [
        createComponentFile("model", "Model", { skin: "gold" }, { model: knight }),
        createComponentFile("patrol", "Script", {
          behavior: "Patrol",
          properties: { speed: 2, target: "door" }
        })
      ]
    }),
    createActorFile("hand", { parentId: "hero" }),
    createActorFile("door")
  ]);

  return { assets, components, file, knight };
}

async function load(
  file: SceneFile,
  level: ReturnType<typeof createLevel>
) {
  const { sm, world } = createSceneSetup(level.assets);
  const scene = new FileScene("level", file, { components: level.components });
  const sceneLoad = sm.loadScene(scene);
  level.assets.loader.resolve("knight");
  await sceneLoad.done;
  sm.beginFrame();

  return { sm, world, scene };
}

describe("Systems.FileScene capture", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  test("writes every live actor back with file ids, data and asset slots", async() => {
    const level = createLevel();
    const { sm, world, scene } = await load(level.file, level);
    const hero = sm.getActor("hero")!;
    hero.object3D.position.set(4, 0, 0);
    hero.getComponent(Patrol)!.speed = 7;
    const coin = new Actor(world as any, { name: "coin", parent: hero });
    coin.addComponent(MeshRenderer);

    const { actors } = scene.capture();

    assert.deepEqual(
      actors.map(({ id, name, parentId }) => [id, name, parentId]),
      [
        ["hero", "hero", null],
        ["hand", "hand", "hero"],
        [coin.persistentId, "coin", "hero"],
        ["door", "door", null]
      ]
    );
    assert.deepEqual(actors[0].transform.position, { x: 4, y: 0, z: 0 });
    assert.deepEqual(actors[0].components, [
      createComponentFile("model", "Model", { skin: "gold" }, { model: level.knight }),
      createComponentFile("patrol", "Script", {
        behavior: "Patrol",
        properties: { speed: 7, target: "door" }
      })
    ]);
    assert.deepEqual(
      actors[2].components.map(({ type }) => type),
      ["Mesh"]
    );
  });

  test("captures the data last applied when the definition cannot capture", () => {
    const { world } = createSceneSetup(createSceneAssets());
    const sign = new Actor(world as any, { name: "sign" });
    const components = new ComponentDefinitions().register({
      type: "Label",
      parse: (data) => data,
      create: (actor) => new ActorComponent({ actor, typeName: "Label" }),
      apply: () => undefined
    });
    const entry = createComponentFile("label", "Label", { text: "old" });
    const label = components.create(sign, entry, {
      mode: "edit",
      resolver: { resolve: () => null as never }
    })!;

    components.apply(label, "Label", { text: "new" });

    assert.deepEqual(
      components.capture(label),
      createComponentFile("label", "Label", { text: "new" })
    );
  });

  test("reloads a capture into the state it was taken from", async() => {
    const level = createLevel();
    const first = await load(level.file, level);
    const hero = first.sm.getActor("hero")!;
    hero.object3D.position.set(4, 0, 0);
    hero.getComponent(Patrol)!.speed = 7;
    first.world.createActor("coin").addComponent(MeshRenderer);
    const capture = first.scene.capture();

    const { sm } = await load(capture, level);

    const reloaded = sm.getActor("hero")!;
    const patrol = reloaded.getComponent(Patrol)!;
    assert.strictEqual(reloaded.object3D.position.x, 4);
    assert.strictEqual(patrol.speed, 7);
    assert.strictEqual(patrol.target, sm.getActor("door"));
    assert.strictEqual(reloaded.getComponent(ModelComponent)!.model, "knight");
    assert.ok(sm.getActor("coin")!.getComponent(MeshRenderer));
  });
});
