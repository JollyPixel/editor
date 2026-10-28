// Import Node.js Dependencies
import {
  describe,
  test,
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
import { Scene } from "../src/systems/scene/Scene.ts";
import { UpdateProbe } from "./helpers/actor/updateProbe.ts";
import {
  ConcreteScene,
  createSceneSetup,
  activateScene
} from "./helpers/scene/sceneSetup.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

describe("Scene", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  describe("update / fixedUpdate", () => {
    test("calls scene.update after actor updates", () => {
      const { sm, world } = createSceneSetup();
      const scene = new ConcreteScene("test");
      const calls: string[] = [];

      activateScene(sm, scene);
      const probe = world.createActor("actor").addComponentAndGet(UpdateProbe);
      sm.beginFrame();
      probe.onUpdate = () => {
        calls.push("actor");
      };
      scene.updateSpy.mock.mockImplementation(() => {
        calls.push("scene");
      });
      sm.update(kDeltaTime);

      assert.deepEqual(calls, ["actor", "scene"]);
      assert.strictEqual(scene.updateSpy.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("calls scene.fixedUpdate after actor fixedUpdates", () => {
      const { sm, world } = createSceneSetup();
      const scene = new ConcreteScene("test");
      const calls: string[] = [];

      activateScene(sm, scene);
      const probe = world.createActor("actor").addComponentAndGet(UpdateProbe);
      sm.beginFrame();
      probe.onFixedUpdate = () => {
        calls.push("actor");
      };
      scene.fixedUpdateSpy.mock.mockImplementation(() => {
        calls.push("scene");
      });
      sm.fixedUpdate(kDeltaTime);

      assert.deepEqual(calls, ["actor", "scene"]);
      assert.strictEqual(scene.fixedUpdateSpy.mock.calls[0].arguments[0], kDeltaTime);
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
