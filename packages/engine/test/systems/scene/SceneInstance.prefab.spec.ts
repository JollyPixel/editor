// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  SceneActorFile,
  ScenePrefabs
} from "../../../src/systems/scene/file/index.ts";
import {
  createInstance,
  type TagComponent
} from "../../helpers/scene/sceneInstance.ts";
import {
  createActorFile,
  createComponentFile
} from "../../helpers/scene/sceneFile.ts";

function prefabs(
  scenes: Map<string, SceneActorFile[]>
): ScenePrefabs {
  return {
    find: (sceneId) => {
      const actors = scenes.get(sceneId);

      return actors === undefined ? null : { actors };
    }
  };
}

function prefabInstance(
  id: string,
  sceneId: string,
  overrides: Partial<SceneActorFile> = {}
): SceneActorFile {
  return createActorFile(id, {
    prefab: { id: sceneId, kind: "scene" },
    ...overrides
  });
}

describe("Systems.SceneInstance prefabs", () => {
  test("expands each instance of a scene under its own root with path ids", () => {
    const scenes = new Map([["tree", [
      createActorFile("trunk", {
        components: [createComponentFile("leaf", "Tag", { label: "oak" })]
      }),
      createActorFile("crown", { parentId: "trunk" })
    ]]]);
    const { sm, instance } = createInstance("play", { prefabs: prefabs(scenes) });

    instance.add([
      prefabInstance("a", "tree", { name: "Tree A", visible: false }),
      prefabInstance("b", "tree")
    ]);

    const a = instance.actor("a")!;
    assert.deepEqual(sm.tree.children, [a, instance.actor("b")]);
    assert.strictEqual(a.name, "Tree A");
    assert.strictEqual(a.object3D.visible, false);
    assert.strictEqual(instance.actor("a/trunk")!.parent, a);
    assert.strictEqual(instance.actor("a/crown")!.parent, instance.actor("a/trunk"));
    assert.strictEqual(instance.actor("b/crown")!.parent, instance.actor("b/trunk"));
    assert.strictEqual((instance.component("a/leaf") as TagComponent).label, "oak");
    assert.strictEqual(instance.component("a/leaf")!.actor, instance.actor("a/trunk"));
  });

  test("expands nested instances and skips a scene already being expanded", () => {
    const scenes = new Map([
      ["house", [prefabInstance("door", "room")]],
      ["room", [createActorFile("lamp"), prefabInstance("loop", "house")]]
    ]);
    const { instance, warnings } = createInstance("edit", {
      prefabs: prefabs(scenes),
      sceneId: "level"
    });

    instance.add([prefabInstance("h", "house"), prefabInstance("self", "level")]);

    assert.ok(instance.actor("h/door/lamp") !== null);
    assert.ok(instance.actor("h/door/loop") !== null);
    assert.strictEqual(instance.actor("h/door/loop/door"), null);
    assert.ok(instance.actor("self") !== null);
    assert.strictEqual(warnings().length, 2);
  });

  test("re-expands every instance of a scene, nested ones included, on refresh", () => {
    const scenes = new Map([
      ["tree", [createActorFile("trunk")]],
      ["grove", [prefabInstance("t", "tree")]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("a", "tree"), prefabInstance("g", "grove")]);
    const trunk = instance.actor("a/trunk")!;

    scenes.set("tree", [createActorFile("stump")]);
    instance.refresh("tree");

    assert.strictEqual(trunk.pendingForDestruction, true);
    assert.strictEqual(instance.actor("a/trunk"), null);
    assert.strictEqual(instance.actor("a/stump")!.parent, instance.actor("a"));
    assert.strictEqual(instance.actor("g/t/stump")!.parent, instance.actor("g/t"));
  });

  test("stops expanding a removed instance whose id comes back as a plain actor", () => {
    const scenes = new Map([["tree", [createActorFile("trunk")]]]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("a", "tree")]);

    instance.remove("a");
    instance.add([createActorFile("a")]);
    instance.refresh("tree");

    assert.ok(instance.actor("a") !== null);
    assert.strictEqual(instance.actor("a/trunk"), null);
  });
});
