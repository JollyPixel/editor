// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Actor, Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  ThreeSceneGraph,
  findActor
} from "../../../src/scene/ThreeSceneGraph.ts";
import { createInstance } from "../../helpers/scene/sceneInstance.ts";
import {
  createActorFile,
  createComponentFile
} from "../../helpers/scene/sceneFile.ts";

function createWorld() {
  const world = { sceneManager: new Systems.SceneManager(new ThreeSceneGraph()) } as any;

  return {
    world,
    createActor(name: string, parent: Actor | null = null) {
      return new Actor(world, { name, parent });
    }
  };
}

function worldPosition(
  object: THREE.Object3D
): number[] {
  object.updateWorldMatrix(true, false);

  return object
    .getWorldPosition(new THREE.Vector3())
    .toArray()
    .map((value) => (Math.round(value * 1e6) / 1e6) + 0);
}

describe("Systems.ThreeSceneGraph", () => {
  test("mirrors the actor hierarchy, name, visibility and layers", () => {
    const { world, createActor } = createWorld();
    const parent = createActor("parent");
    const child = createActor("child", parent);
    const other = createActor("other");

    child.name = "renamed";
    child.transform.visible = false;
    child.reparent(other);
    new Actor(world, { name: "layered", layer: 3 });

    assert.strictEqual(child.node.object3D.parent, other.node.object3D);
    assert.strictEqual(child.node.object3D.name, "renamed");
    assert.strictEqual(child.node.object3D.visible, false);
    assert.strictEqual(world.sceneManager.graph.scene.layers.isEnabled(3), true);

    child.reparent(null);

    assert.strictEqual(child.node.object3D.parent, world.sceneManager.graph.scene);
  });

  test("places a node where the engine transform puts the actor", () => {
    const { createActor } = createWorld();
    const parent = createActor("parent");
    parent.transform.local.position = { x: 10, y: 0, z: 0 };
    parent.transform.local.eulerAngles = new THREE.Euler(0, Math.PI / 2, 0);
    const child = createActor("child", parent);
    child.transform.local.position = { x: 0, y: 0, z: -2 };

    child.reparent(null);

    assert.deepEqual(
      worldPosition(child.node.object3D),
      Object.values(child.transform.global.position).map((value) => (Math.round(value * 1e6) / 1e6) + 0)
    );
    assert.deepEqual(worldPosition(child.node.object3D), [8, 0, 0]);
  });

  test("seats an anchored actor in a socket so its node keeps the local pose", () => {
    const { instance } = createInstance("edit", { graph: new ThreeSceneGraph() });
    instance.add([
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
        anchor: { component: "markers", key: "spawn" }
      })
    ]);
    const hero = instance.actor("hero")!;
    const socket = hero.node.object3D.parent!;

    assert.strictEqual(socket.parent, instance.actor("map")!.node.object3D);
    assert.deepEqual(hero.node.object3D.position.toArray(), [0, 0, 0]);
    assert.deepEqual(worldPosition(hero.node.object3D), [105, 0, 0]);

    hero.reparent(null);

    assert.strictEqual(hero.node.object3D.parent, instance.actor("map")!.world.sceneManager.graph.scene);
    assert.strictEqual(socket.parent, null);
  });

  test("places root actors on the scene and takes them off once destroyed", () => {
    const { world, createActor } = createWorld();
    const actor = createActor("root");
    const child = createActor("child", actor);

    assert.deepStrictEqual(world.sceneManager.graph.scene.children, [actor.node.object3D]);
    assert.strictEqual(child.node.object3D.parent, actor.node.object3D);

    actor.destroy();

    assert.deepStrictEqual(world.sceneManager.graph.scene.children, []);
    assert.strictEqual(world.sceneManager.actors.has(child), false);
  });

  test("finds the actor owning a nested three object", () => {
    const { createActor } = createWorld();
    const actor = createActor("owner");
    const mesh = new THREE.Object3D();
    actor.node.object3D.add(mesh);

    assert.strictEqual(findActor(mesh), actor);
    assert.strictEqual(findActor(new THREE.Object3D()), null);
  });

  test("removes destroyed actors and loose objects but keeps survivors when cleared", () => {
    const { world, createActor } = createWorld();
    const kept = createActor("kept");
    kept.persistent = true;
    createActor("dropped");
    world.sceneManager.graph.scene.add(new THREE.Object3D());

    world.sceneManager.actors.clear();

    assert.deepEqual(world.sceneManager.graph.scene.children, [kept.node.object3D]);
  });
});
