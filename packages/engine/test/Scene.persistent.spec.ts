// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import {
  ComponentDefinitions,
  FileScene
} from "../src/systems/scene/file/index.ts";
import {
  ConcreteScene,
  createSceneSetup,
  activateScene,
  activateAppendedScene
} from "./helpers/scene/sceneSetup.ts";
import {
  createActorFile,
  createSceneFile
} from "./helpers/scene/sceneFile.ts";
import { UpdateProbe } from "./helpers/actor/updateProbe.ts";

describe("Scene persistent actors", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  test("keeps a persistent root, its children and its updates across a scene replacement", () => {
    const { sm, world } = createSceneSetup();
    const player = new Actor(world as any, { name: "player", persistent: true });
    new Actor(world as any, { name: "hand", parent: player });
    const probe = player.addComponentAndGet(UpdateProbe);
    const enemy = new Actor(world as any, { name: "enemy" });
    activateScene(sm, new ConcreteScene("first"));

    activateScene(sm, new ConcreteScene("second"));
    sm.update(0);

    assert.deepEqual(sm.tree.children, [player]);
    assert.notStrictEqual(sm.tree.getActor("player/hand"), null);
    assert.strictEqual(player.object3D.parent, sm.default);
    assert.strictEqual(enemy.pendingForDestruction, true);
    assert.strictEqual(probe.updates, 1);
  });

  test("keeps a persistent root when the appended scene that created it is removed", () => {
    const { sm, world } = createSceneSetup();
    activateScene(sm, new ConcreteScene("level"));
    const hud = new ConcreteScene("hud");
    let overlay: Actor | null = null;
    hud.awakeSpy.mock.mockImplementation(() => {
      overlay = new Actor(world as any, { name: "overlay", persistent: true });
      new Actor(world as any, { name: "label", parent: overlay });
      new Actor(world as any, { name: "popup" });
    });
    activateAppendedScene(sm, hud);

    sm.removeScene(hud);

    assert.deepEqual(sm.tree.children, [overlay]);
    assert.strictEqual(overlay!.children.length, 1);
  });

  test("keeps the live persistent actor over the file actor that shares its id", () => {
    const { sm, world } = createSceneSetup();
    const player = new Actor(world as any, {
      name: "player",
      persistentId: "player",
      persistent: true
    });
    activateScene(sm, new ConcreteScene("first"));

    const file = createSceneFile([
      createActorFile("player", { name: "saved player" }),
      createActorFile("sword", { parentId: "player" }),
      createActorFile("rock")
    ]);
    activateScene(sm, new FileScene("level", file, {
      components: new ComponentDefinitions()
    }));

    assert.deepEqual(sm.tree.children.map((actor) => actor.name), ["player", "rock"]);
    assert.strictEqual(sm.tree.children[0], player);
    assert.deepEqual(player.children, []);
  });
});
