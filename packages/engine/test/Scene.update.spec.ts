// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetId,
  AssetReference,
  AssetType,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Logger } from "../src/systems/Logger.ts";
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import { SceneManager } from "../src/systems/scene/SceneManager.ts";
import { createSceneAssets, type SceneAssets } from "./sceneAssets.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

class ConcreteScene extends Scene {
  awakeSpy = mock.fn();
  startSpy = mock.fn();
  updateSpy = mock.fn();
  fixedUpdateSpy = mock.fn();
  destroySpy = mock.fn();
  override awake(): void {
    this.awakeSpy();
  }

  override start(): void {
    this.startSpy();
  }

  override update(deltaTime: number): void {
    this.updateSpy(deltaTime);
  }

  override fixedUpdate(deltaTime: number): void {
    this.fixedUpdateSpy(deltaTime);
  }

  override destroy(): void {
    this.destroySpy();
  }
}

function createSceneSetup(
  assets: SceneAssets = createSceneAssets()
) {
  const sm = new SceneManager();
  const world = {
    logger: new Logger(),
    sceneManager: sm,
    assetCoordinator: assets.coordinator,
    createActor(name: string) {
      return new Actor(this as any, { name });
    }
  };
  sm.bindWorld(world as any);

  return { sm, world };
}

function activateScene(
  sceneManager: SceneManager,
  scene: Scene
): void {
  sceneManager.loadScene(scene);
  sceneManager.beginFrame();
}

describe("Scene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("update / fixedUpdate", () => {
    test("calls scene.update after actor updates", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      activateScene(sm, scene);
      sm.beginFrame();
      sm.update(kDeltaTime);

      assert.strictEqual(scene.updateSpy.mock.calls.length, 1);
      assert.strictEqual(scene.updateSpy.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("calls scene.fixedUpdate after actor fixedUpdates", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      activateScene(sm, scene);
      sm.beginFrame();
      sm.fixedUpdate(kDeltaTime);

      assert.strictEqual(scene.fixedUpdateSpy.mock.calls.length, 1);
      assert.strictEqual(scene.fixedUpdateSpy.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("does not call update/fixedUpdate when no scene is set", () => {
      const { sm } = createSceneSetup();
      const updateSpy = mock.fn();
      const fixedUpdateSpy = mock.fn();

      sm.update(kDeltaTime);
      sm.fixedUpdate(kDeltaTime);

      assert.strictEqual(updateSpy.mock.calls.length, 0);
      assert.strictEqual(fixedUpdateSpy.mock.calls.length, 0);
    });

    test("scene.update is called every frame", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      activateScene(sm, scene);
      sm.beginFrame();
      sm.update(kDeltaTime);
      sm.update(kDeltaTime);
      sm.update(kDeltaTime);

      assert.strictEqual(scene.updateSpy.mock.calls.length, 3);
    });
  });

  describe("Scene.id", () => {
    test("each scene instance gets a unique incrementing id", () => {
      const a = new ConcreteScene("a");
      const b = new ConcreteScene("b");
      const c = new ConcreteScene("c");

      assert.strictEqual(a.id, 0);
      assert.strictEqual(b.id, 1);
      assert.strictEqual(c.id, 2);
    });

    test("two scenes with the same name have different ids", () => {
      const a = new ConcreteScene("same");
      const b = new ConcreteScene("same");

      assert.notStrictEqual(a.id, b.id);
    });
  });

  describe("assets", () => {
    test("exposes the references declared at construction", () => {
      const type = new AssetType<string>("text");
      const reference = new AssetReference(
        new AssetId("dialogue.intro"),
        type
      );
      const scene = new ConcreteScene("test", {
        assets: [reference]
      });

      assert.deepEqual(scene.assets, [reference]);
      assert.strictEqual(Object.isFrozen(scene.assets), true);
    });

    test("flattens named reference groups", () => {
      const type = new AssetType<string>("text");
      const standalone = new AssetReference("dialogue.title", type);
      const componentAssets = {
        intro: new AssetReference("dialogue.intro", type),
        ending: new AssetReference("dialogue.ending", type)
      } satisfies AssetReferenceGroup;
      const scene = new ConcreteScene("test", {
        assets: [standalone, componentAssets]
      });

      assert.deepEqual(scene.assets, [
        standalone,
        componentAssets.intro,
        componentAssets.ending
      ]);
    });
  });
});
