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

  test("expands an instance with its overrides and ignores paths its scene lacks", () => {
    const scenes = new Map([["tree", [
      createActorFile("trunk", {
        components: [createComponentFile("leaf", "Tag", { label: "oak" })]
      })
    ]]]);
    const { instance, resolved } = createInstance("edit", { prefabs: prefabs(scenes) });

    instance.add([prefabInstance("a", "tree", {
      overrides: {
        actors: {
          trunk: { name: "Birch", visible: false, transform: { position: { x: 2, y: 0, z: 0 } } },
          gone: { name: "Gone" }
        },
        components: {
          leaf: { data: { label: "birch" }, assets: { map: { id: "bark", kind: "texture" } } }
        }
      }
    })]);

    const trunk = instance.actor("a/trunk")!;
    assert.strictEqual(trunk.name, "Birch");
    assert.strictEqual(trunk.object3D.visible, false);
    assert.strictEqual(trunk.object3D.position.x, 2);
    const leaf = instance.component("a/leaf") as TagComponent;
    assert.strictEqual(leaf.label, "birch");
    assert.strictEqual(leaf.componentContext.assets.resolve("map"), "value:bark");
    assert.deepEqual(resolved, [{ id: "bark", kind: "texture" }]);
    assert.strictEqual(instance.actor("a/gone"), null);
  });

  test("hands overrides down to a nested instance, where they win over its own", () => {
    const scenes = new Map([
      ["tree", [createActorFile("trunk")]],
      ["grove", [prefabInstance("t", "tree", {
        overrides: { actors: { trunk: { name: "Grove trunk", visible: false } } }
      })]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });

    instance.add([prefabInstance("g", "grove", {
      overrides: { actors: { "t/trunk": { name: "Level trunk" } } }
    })]);

    const trunk = instance.actor("g/t/trunk")!;
    assert.strictEqual(trunk.name, "Level trunk");
    assert.strictEqual(trunk.object3D.visible, false);
  });

  test("applies new overrides to a live instance and rebuilds only the components they change", () => {
    const scenes = new Map([
      ["tree", [
        createActorFile("trunk", {
          components: [
            createComponentFile("leaf", "Tag", { label: "oak" }),
            createComponentFile("bark", "Tag", { label: "rough" })
          ]
        })
      ]],
      ["grove", [prefabInstance("t", "tree")]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("a", "tree"), prefabInstance("g", "grove")]);
    const trunk = instance.actor("a/trunk")!;
    const bark = instance.component("a/bark");

    instance.override("a", {
      actors: { trunk: { name: "Birch" } },
      components: { leaf: { data: { label: "birch" } } }
    });
    instance.override("g", { actors: { "t/trunk": { name: "Grove trunk" } } });

    assert.strictEqual(instance.actor("a/trunk"), trunk);
    assert.strictEqual(trunk.name, "Birch");
    assert.strictEqual((instance.component("a/leaf") as TagComponent).label, "birch");
    assert.strictEqual(instance.component("a/bark"), bark);
    assert.strictEqual(instance.actor("g/t/trunk")!.name, "Grove trunk");

    instance.override("a", undefined);

    assert.strictEqual(trunk.name, "trunk");
    assert.strictEqual((instance.component("a/leaf") as TagComponent).label, "oak");
  });

  test("lists the expanded actors of an instance with their overrides, nested ones included", () => {
    const scenes = new Map([
      ["tree", [createActorFile("trunk")]],
      ["grove", [createActorFile("path"), prefabInstance("t", "tree")]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("g", "grove", {
      overrides: { actors: { "t/trunk": { name: "Oak" } } }
    })]);

    const expanded = [...instance.expandedActors("g")];

    assert.deepEqual(
      expanded.map(({ id, parentId, name }) => [id, parentId, name]),
      [["g/path", "g", "path"], ["g/t", "g", "t"], ["g/t/trunk", "g/t", "Oak"]]
    );
  });

  test("finds an expanded actor and component by id, as the latest overrides leave them", () => {
    const scenes = new Map([
      ["tree", [createActorFile("trunk", {
        components: [createComponentFile("leaf", "Tag", { label: "oak" })]
      })]],
      ["grove", [prefabInstance("t", "tree")]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("g", "grove")]);

    instance.override("g", {
      actors: { "t/trunk": { name: "Birch" } },
      components: { "t/leaf": { data: { label: "birch" } } }
    });

    assert.strictEqual(instance.expandedActor("g/t/trunk")?.name, "Birch");
    assert.deepEqual(instance.expandedComponent("g/t/leaf")?.data, { label: "birch" });
    assert.strictEqual(instance.expandedActor("g/t/branch"), null);
    assert.strictEqual(instance.expandedActor("g"), null);

    instance.remove("g");

    assert.strictEqual(instance.expandedActor("g/t/trunk"), null);
    assert.strictEqual(instance.expandedComponent("g/t/leaf"), null);
  });

  test("lists each scene its instances expand once, and forgets the scenes of removed instances", () => {
    const scenes = new Map([
      ["tree", [createActorFile("trunk")]],
      ["grove", [prefabInstance("t", "tree")]]
    ]);
    const { instance } = createInstance("edit", { prefabs: prefabs(scenes) });
    instance.add([prefabInstance("a", "tree"), prefabInstance("g", "grove")]);

    assert.deepEqual([...instance.prefabSceneIds()], ["tree", "grove"]);

    instance.remove("a");
    instance.remove("g");

    assert.deepEqual([...instance.prefabSceneIds()], []);
  });
});
