// Import Node.js Dependencies
import { beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../../src/actor/index.ts";
import { Logger } from "../../src/systems/Logger.ts";
import { Scene } from "../../src/systems/scene/Scene.ts";
import { SceneManager } from "../../src/systems/scene/SceneManager.ts";
import type {
  SceneLoadDriver
} from "../../src/systems/scene/SceneLoader.ts";

class ConcreteScene extends Scene {
  awakeSpy = mock.fn();

  override awake(): void {
    this.awakeSpy();
  }
}

function createSceneManager(): SceneManager {
  const sceneManager = new SceneManager();
  const world = {
    logger: new Logger(),
    sceneManager,
    assetCoordinator: {},
    createActor(name: string) {
      return new Actor(this as any, {
        name
      });
    }
  };
  sceneManager.bindWorld(world as any);

  return sceneManager;
}

describe("Systems.SceneManager loading", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("appendScene", () => {
    test("waits for its assets before appending the scene", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");
      let driver!: SceneLoadDriver;
      sceneManager.setSceneLoader({
        load(sceneLoadDriver) {
          driver = sceneLoadDriver;
          driver.start(0, 1);
        }
      });

      const load = sceneManager.appendScene(appended);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "loading");
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);

      driver.ready();
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sceneManager.getScene(appended.id), appended);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 1);
    });

    test("supports manual activation for appended scenes", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");

      const load = sceneManager.appendScene(appended, {
        activation: "manual"
      });
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sceneManager.getScene(appended.id), null);

      load.allowActivation();
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sceneManager.getScene(appended.id), appended);
    });

    test("loads different appended scenes independently", () => {
      const sceneManager = createSceneManager();
      const first = new ConcreteScene("first");
      const second = new ConcreteScene("second");
      const drivers: SceneLoadDriver[] = [];
      sceneManager.setSceneLoader({
        load(driver) {
          drivers.push(driver);
          driver.start(0, 1);
        }
      });

      const firstLoad = sceneManager.appendScene(first);
      const secondLoad = sceneManager.appendScene(second);
      drivers[0]!.ready();
      drivers[1]!.ready();
      sceneManager.beginFrame();

      assert.strictEqual(firstLoad.status, "active");
      assert.strictEqual(secondLoad.status, "active");
      assert.strictEqual(sceneManager.getScene(first.id), first);
      assert.strictEqual(sceneManager.getScene(second.id), second);
    });

    test("does not append a scene when its loader fails", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");
      const error = new Error("load failed");
      sceneManager.setSceneLoader({
        load(driver) {
          driver.start(0, 1);
          driver.fail(error);
        }
      });

      const load = sceneManager.appendScene(appended);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "failed");
      assert.strictEqual(load.error, error);
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });
  });

  describe("additive cancellation", () => {
    test("removeScene cancels an unfinished request", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");
      sceneManager.setSceneLoader({
        load(driver) {
          driver.start(0, 1);
        }
      });

      const load = sceneManager.appendScene(appended);
      sceneManager.removeScene(appended);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "cancelled");
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });

    test("replacement cancels an unfinished request", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");
      const replacement = new ConcreteScene("next");
      let appendedDriver!: SceneLoadDriver;
      sceneManager.setSceneLoader({
        load(driver) {
          if (driver.load.scene === appended) {
            appendedDriver = driver;
            driver.start(0, 1);
          }
          else {
            driver.start(0, 0);
            driver.ready();
          }
        }
      });

      const appendedLoad = sceneManager.appendScene(appended);
      sceneManager.loadScene(replacement);
      sceneManager.beginFrame();

      appendedDriver.ready();
      sceneManager.beginFrame();

      assert.strictEqual(appendedLoad.status, "cancelled");
      assert.strictEqual(sceneManager.currentScene, replacement);
      assert.strictEqual(sceneManager.getScene(appended.id), null);
    });
  });
});
