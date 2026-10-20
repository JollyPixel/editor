// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import { createSceneAssets } from "./sceneAssets.ts";
import {
  ConcreteScene,
  activateAppendedScene,
  activateScene,
  createSceneSetup
} from "./helpers/sceneSetup.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

describe("SceneManager.unloadScene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  test("tears the current scene and its actors down at once, leaving no current scene", () => {
    const { sm, world } = createSceneSetup();

    class LevelScene extends ConcreteScene {
      override awake() {
        super.awake();
        world.createActor("LevelActor");
      }
    }

    const level = new LevelScene("level");
    activateScene(sm, level);
    sm.unloadScene(level);

    assert.strictEqual(level.destroySpy.mock.calls.length, 1);
    assert.strictEqual(sm.getActor("LevelActor"), null);
    assert.strictEqual(sm.currentScene, null);
  });

  test("tears down the scenes appended to the current scene", () => {
    const { sm } = createSceneSetup();
    const level = new ConcreteScene("level");
    const prefab = new ConcreteScene("prefab");
    const removed: string[] = [];

    sm.on("sceneRemoved", (scene) => removed.push(scene.name));
    activateScene(sm, level);
    activateAppendedScene(sm, prefab);
    sm.unloadScene(level);

    assert.strictEqual(prefab.destroySpy.mock.calls.length, 1);
    assert.deepEqual(removed, ["prefab"]);
    assert.strictEqual(sm.getScene(prefab.id), null);
  });

  test("cancels pending append loads so they never activate", async() => {
    const assets = createSceneAssets(["a"]);
    const { sm } = createSceneSetup(assets);
    const level = new ConcreteScene("level");
    const prefab = new ConcreteScene("prefab", {
      assets: [assets.reference("a")]
    });

    activateScene(sm, level);
    const load = sm.appendScene(prefab);
    sm.unloadScene(level);
    assets.loader.resolve("a");
    await assert.rejects(load.done);
    sm.beginFrame();

    assert.strictEqual(load.status, "cancelled");
    assert.strictEqual(prefab.awakeSpy.mock.calls.length, 0);
    assert.strictEqual(sm.getScene(prefab.id), null);
  });

  test("cancels a pending replacement load of the scene", async() => {
    const assets = createSceneAssets(["a"]);
    const { sm } = createSceneSetup(assets);
    const level = new ConcreteScene("level", {
      assets: [assets.reference("a")]
    });

    const load = sm.loadScene(level);
    sm.unloadScene(level);
    assets.loader.resolve("a");
    await assert.rejects(load.done);
    sm.beginFrame();

    assert.strictEqual(load.status, "cancelled");
    assert.strictEqual(level.awakeSpy.mock.calls.length, 0);
    assert.strictEqual(sm.currentScene, null);
  });

  test("leaves the current scene and loads untouched for another scene", async() => {
    const assets = createSceneAssets(["a"]);
    const { sm } = createSceneSetup(assets);
    const level = new ConcreteScene("level");
    const other = new ConcreteScene("other");
    const prefab = new ConcreteScene("prefab", {
      assets: [assets.reference("a")]
    });

    activateScene(sm, level);
    const load = sm.appendScene(prefab);
    sm.unloadScene(other);
    assets.loader.resolve("a");
    await load.done;
    sm.beginFrame();

    assert.strictEqual(sm.currentScene, level);
    assert.strictEqual(level.destroySpy.mock.calls.length, 0);
    assert.strictEqual(load.status, "active");
  });

  test("is a no-op when the scene was already unloaded", () => {
    const { sm } = createSceneSetup();
    const level = new ConcreteScene("level");
    const destroyed = mock.fn();

    sm.on("sceneDestroyed", destroyed);
    activateScene(sm, level);
    sm.unloadScene(level);
    sm.unloadScene(level);

    assert.strictEqual(level.destroySpy.mock.calls.length, 1);
    assert.strictEqual(destroyed.mock.calls.length, 1);
  });

  test("skips the torn-down actors for the rest of an in-progress frame", () => {
    const { sm, world } = createSceneSetup();
    const level = new ConcreteScene("level");
    activateScene(sm, level);
    const first = world.createActor("First");
    const second = world.createActor("Second");
    sm.beginFrame();

    mock.method(first, "update", () => sm.unloadScene(level));
    const secondUpdate = mock.method(second, "update");
    const secondFixedUpdate = mock.method(second, "fixedUpdate");
    sm.update(kDeltaTime);
    sm.fixedUpdate(kDeltaTime);
    sm.endFrame();

    assert.strictEqual(secondUpdate.mock.calls.length, 0);
    assert.strictEqual(secondFixedUpdate.mock.calls.length, 0);
    assert.strictEqual(level.updateSpy.mock.calls.length, 0);
  });
});
