// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createInstance } from "../../helpers/scene/sceneInstance.ts";
import {
  createActorFile,
  createComponentFile
} from "../../helpers/scene/sceneFile.ts";
import type { MarkersComponent } from "../../helpers/scene/sceneAnchors.ts";

function createAnchoredScene() {
  const created = createInstance("edit");
  created.instance.add([
    createActorFile("map", {
      transform: {
        position: { x: 100, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      components: [createComponentFile("markers", "Markers", { spawn: 5 })]
    }),
    createActorFile("hero", {
      parentId: "map",
      anchor: { component: "markers", key: "spawn" },
      transform: {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    })
  ]);
  const markers = created.instance.component("markers") as MarkersComponent;

  return { ...created, markers };
}

function worldPosition(
  object: THREE.Object3D
): number[] {
  return object
    .getWorldPosition(new THREE.Vector3())
    .toArray()
    .map((value) => Math.round(value * 1e6) / 1e6);
}

describe("Systems.SceneInstance anchors", () => {
  test("places an anchored child relative to the anchor of its parent's component", () => {
    const { instance } = createAnchoredScene();

    const hero = instance.actor("hero")!;
    assert.strictEqual(hero.parent, instance.actor("map"));
    assert.deepEqual(worldPosition(hero.object3D), [105, 1, 0]);
  });

  test("moves and turns the child when its anchor moves", () => {
    const { instance, markers } = createAnchoredScene();
    let changes = 0;
    instance.on("anchorsChange", () => changes++);

    markers.anchors.place("spawn", { x: 0, y: 0, z: 8 }, 90);

    const hero = instance.actor("hero")!;
    assert.deepEqual(worldPosition(hero.object3D), [100, 1, 8]);
    assert.ok(Math.abs(
      hero.object3D.getWorldQuaternion(new THREE.Quaternion()).angleTo(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
      )
    ) < 1e-6);
    assert.strictEqual(changes, 1);
  });

  test("keeps a child whose anchor is gone at its parent's origin until it returns", () => {
    const { instance, markers } = createAnchoredScene();
    const hero = instance.actor("hero")!;

    markers.anchors.remove("spawn");
    assert.deepEqual(worldPosition(hero.object3D), [100, 1, 0]);

    markers.anchors.place("spawn", { x: 2, y: 0, z: 0 });
    assert.deepEqual(worldPosition(hero.object3D), [102, 1, 0]);
  });

  test("ignores an anchor that names a component of another actor", () => {
    const { instance } = createInstance("edit");

    instance.add([
      createActorFile("map", {
        components: [createComponentFile("markers", "Markers", { spawn: 5 })]
      }),
      createActorFile("crate"),
      createActorFile("hero", {
        parentId: "crate",
        anchor: { component: "markers", key: "spawn" }
      })
    ]);

    assert.deepEqual(worldPosition(instance.actor("hero")!.object3D), [0, 0, 0]);
    assert.strictEqual(
      instance.findAnchor("crate", { component: "markers", key: "spawn" }),
      null
    );
  });

  test("moves a child onto an anchor and off it again", () => {
    const { instance } = createAnchoredScene();
    instance.add([createActorFile("coin", { parentId: "map" })]);
    const coin = instance.actor("coin")!;

    instance.reparent("coin", "map", { component: "markers", key: "spawn" });
    assert.deepEqual(worldPosition(coin.object3D), [105, 0, 0]);

    instance.reparent("coin", "map");
    assert.deepEqual(worldPosition(coin.object3D), [100, 0, 0]);
    assert.strictEqual(coin.parent, instance.actor("map"));
  });

  test("drops a socket once no actor hangs from it", () => {
    const { instance } = createAnchoredScene();
    const map = instance.actor("map")!;
    const unanchoredChildren = map.object3D.children.length - 1;

    instance.reparent("hero", "map");
    assert.strictEqual(map.object3D.children.length, unanchoredChildren + 1);

    instance.reparent("hero", "map", { component: "markers", key: "spawn" });
    instance.remove("hero");
    assert.strictEqual(map.object3D.children.length, unanchoredChildren);
  });

  test("lists the anchors of an actor's components", () => {
    const { instance, markers } = createAnchoredScene();
    markers.anchors.place("exit", { x: 9, y: 0, z: 0 });

    assert.deepEqual(
      [...instance.anchors("map")].map(({ component, anchor }) => [component, anchor.key]),
      [["markers", "spawn"], ["markers", "exit"]]
    );
    assert.deepEqual([...instance.anchors("hero")], []);
  });

  test("scopes the anchors of a prefab's actors to the instance", () => {
    const { instance } = createInstance("edit", {
      prefabs: {
        find: () => {
          return {
            actors: [
              createActorFile("map", {
                components: [createComponentFile("markers", "Markers", { spawn: 3 })]
              }),
              createActorFile("hero", {
                parentId: "map",
                anchor: { component: "markers", key: "spawn" }
              })
            ]
          };
        }
      }
    });

    instance.add([
      createActorFile("level", { prefab: { id: "dungeon", kind: "scene" } })
    ]);

    assert.deepEqual(worldPosition(instance.actor("level/hero")!.object3D), [3, 0, 0]);
  });
});
