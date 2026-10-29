// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  ComponentChange,
  SceneDocument,
  SceneEnvironment,
  type SceneEnvironmentJSON
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import {
  createProbeBinding,
  Probe
} from "../helpers/probeComponents.ts";

describe("SceneBinding", () => {
  test("builds the document's actors under their parents with their components", () => {
    const document = new SceneDocument();
    const rootId = document.addActor({
      name: "Root",
      transform: { position: { x: 1, y: 2, z: 3 } }
    })!;
    const childId = document.addActor({
      name: "Child",
      parentId: rootId,
      components: [{ id: "probe", type: "Patched", data: { label: "sun" }, assets: {} }]
    })!;

    const { binding, environments } = createProbeBinding(document);

    const root = binding.actor(rootId)!;
    const child = binding.actor(childId)!;
    assert.strictEqual(child.parent, root);
    assert.deepEqual(root.object3D.position.toArray(), [1, 2, 3]);
    assert.strictEqual((binding.component("probe") as Probe).label, "sun");
    assert.deepEqual(environments, [document.tree.environment]);
  });

  test("builds an added subtree under its parent and forgets a removed one", () => {
    const document = new SceneDocument();
    const rootId = document.addActor({ name: "Root" })!;
    const { binding, sceneManager } = createProbeBinding(document);

    const addedId = document.addActor({
      name: "Added",
      parentId: rootId,
      components: [{ id: "probe", type: "Patched", data: {}, assets: {} }]
    })!;
    const added = binding.actor(addedId)!;
    assert.strictEqual(added.parent, binding.actor(rootId));

    document.remove(rootId);

    assert.strictEqual(binding.actor(rootId), null);
    assert.strictEqual(binding.actor(addedId), null);
    assert.strictEqual(binding.component("probe"), null);
    assert.deepEqual(sceneManager.tree.children, []);
  });

  test("patches a component through apply and rebuilds one whose definition has none", () => {
    const document = new SceneDocument();
    document.addActor({
      name: "Actor",
      components: [
        { id: "patched", type: "Patched", data: { label: "a" }, assets: {} },
        { id: "rebuilt", type: "Rebuilt", data: { label: "a" }, assets: {} }
      ]
    });
    const { binding } = createProbeBinding(document);
    const patched = binding.component("patched");
    const rebuilt = binding.component("rebuilt");

    document.changeComponent("patched", new ComponentChange({ data: { label: "b" } }));
    document.changeComponent("rebuilt", new ComponentChange({ data: { label: "b" } }));

    assert.strictEqual(binding.component("patched"), patched);
    assert.strictEqual((patched as Probe).label, "b");
    assert.notStrictEqual(binding.component("rebuilt"), rebuilt);
    assert.strictEqual((binding.component("rebuilt") as Probe).label, "b");
    assert.ok(rebuilt?.pendingForDestruction);
  });

  test("reparents a moved actor and writes the transform the move carries", () => {
    const document = new SceneDocument();
    const rootId = document.addActor({ name: "Root" })!;
    const childId = document.addActor({ name: "Child", parentId: rootId })!;
    const { binding } = createProbeBinding(document);

    document.move(childId, { parentId: null }, {
      transform: {
        position: { x: 4, y: 0, z: 0 },
        rotation: { x: 0, y: 90, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    });

    const child = binding.actor(childId)!;
    assert.strictEqual(child.parent, null);
    assert.deepEqual(child.object3D.position.toArray(), [4, 0, 0]);
    assert.ok(Math.abs(child.object3D.rotation.y - (Math.PI / 2)) < 1e-9);
  });

  test("moves an actor onto the anchor a move names and lists its owner's anchors", () => {
    const document = new SceneDocument();
    const mapId = document.addActor({
      name: "Map",
      components: [{ id: "map", type: "Anchored", data: {}, assets: {} }]
    })!;
    const coinId = document.addActor({ name: "Coin" })!;
    const { binding } = createProbeBinding(document);

    document.move(coinId, {
      parentId: mapId,
      anchor: { component: "map", key: "object:spawn" }
    }, {
      transform: {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    });

    const coin = binding.actor(coinId)!;
    assert.strictEqual(coin.parent, binding.actor(mapId));
    assert.deepEqual(coin.object3D.getWorldPosition(new THREE.Vector3()).toArray(), [5, 1, 0]);
    assert.deepEqual([...binding.anchors(mapId)].map(({ anchor }) => anchor.label), ["Spawn"]);
  });

  test("rebuilds every actor and the environment when the document resets", () => {
    const document = new SceneDocument();
    const oldId = document.addActor({ name: "Old" })!;
    const { binding, sceneManager, environments } = createProbeBinding(document);
    const foggy: SceneEnvironmentJSON = {
      ...SceneEnvironment.create(),
      fog: { kind: "exp2", color: "#ffffff", density: 0.1 }
    };

    document.load({
      environment: foggy,
      actors: [
        {
          id: "fresh",
          name: "Fresh",
          parentId: null,
          visible: false,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          components: []
        }
      ]
    });

    const fresh = binding.actor("fresh")!;
    assert.strictEqual(binding.actor(oldId), null);
    assert.deepEqual(sceneManager.tree.children, [fresh]);
    assert.strictEqual(fresh.object3D.visible, false);
    assert.deepEqual(environments.at(-1), foggy);
  });

  test("previews an environment patch over the document without changing it", () => {
    const document = new SceneDocument();
    const stored = document.tree.environment;
    const { binding, environments } = createProbeBinding(document);

    binding.previewEnvironment({ background: "#ff0000" });

    assert.deepEqual(environments.at(-1), {
      ...stored,
      background: "#ff0000"
    });
    assert.deepEqual(document.tree.environment, stored);
  });

  test("previews a component change through apply without changing the document", () => {
    const document = new SceneDocument();
    document.addActor({
      name: "Actor",
      components: [
        { id: "patched", type: "Patched", data: { label: "a" }, assets: {} },
        { id: "rebuilt", type: "Rebuilt", data: { label: "a" }, assets: {} }
      ]
    });
    const { binding } = createProbeBinding(document);
    const patched = binding.component("patched") as Probe;
    const rebuilt = binding.component("rebuilt") as Probe;

    binding.previewComponent("patched", new ComponentChange({ data: { label: "b" } }));
    binding.previewComponent("rebuilt", new ComponentChange({ data: { label: "b" } }));
    assert.strictEqual(patched.label, "b");
    assert.strictEqual(binding.component("rebuilt"), rebuilt);
    assert.strictEqual(rebuilt.label, "a");
    assert.deepEqual(document.tree.component("patched")?.data, { label: "a" });

    binding.previewComponent("patched", new ComponentChange({ unset: ["label"] }));
    assert.strictEqual(patched.label, "none");
  });

  test("previews a transform patch over the stored transform without changing the document", () => {
    const document = new SceneDocument();
    const scale = { x: 2, y: 2, z: 2 };
    const actorId = document.addActor({ name: "Actor", transform: { scale } })!;
    const { binding } = createProbeBinding(document);
    const { object3D } = binding.actor(actorId)!;

    binding.previewTransform(actorId, { position: { x: 5, y: 0, z: 0 } });
    assert.deepEqual(object3D.position.toArray(), [5, 0, 0]);
    assert.deepEqual(object3D.scale.toArray(), [2, 2, 2]);
    assert.deepEqual(document.tree.actor(actorId)?.transform.position, { x: 0, y: 0, z: 0 });
  });

  test("finds the actor that owns a nested object", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor" })!;
    const { binding } = createProbeBinding(document);
    const mesh = new THREE.Object3D();
    binding.actor(actorId)!.object3D.add(mesh);

    assert.strictEqual(binding.findActorId(mesh), actorId);
    assert.strictEqual(binding.findActorId(new THREE.Object3D()), null);
  });

  test("resolves an outside pick target to its actor until it is released", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor" })!;
    const { binding } = createProbeBinding(document);
    const marker = new THREE.Group();
    marker.add(new THREE.Object3D());

    const release = binding.addPickTarget(marker, actorId);
    assert.strictEqual(binding.findActorId(marker.children[0]), actorId);

    release();
    assert.strictEqual(binding.findActorId(marker.children[0]), null);
  });

  test("reports each component it builds and drops, across a rebuild and a removal", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({
      name: "Actor",
      components: [{ id: "rebuilt", type: "Rebuilt", data: {}, assets: {} }]
    })!;
    const { binding } = createProbeBinding(document);
    const live = new Set([...binding.components()].map(({ component }) => component));
    binding.on("componentBuilt", ({ component, actorId: ownerId }) => {
      assert.strictEqual(ownerId, actorId);
      live.add(component);
    });
    binding.on("componentDropped", (component) => live.delete(component));

    document.changeComponent("rebuilt", new ComponentChange({ data: { label: "b" } }));
    assert.deepEqual([...live], [binding.component("rebuilt")]);

    document.remove(actorId);
    assert.deepEqual([...live], []);
  });

  test("bounds the given actors, an empty one by its position", () => {
    const document = new SceneDocument();
    const emptyId = document.addActor({
      name: "Empty",
      transform: { position: { x: 4, y: 0, z: 0 } }
    })!;
    const boxId = document.addActor({ name: "Box" })!;
    const { binding } = createProbeBinding(document);
    binding.actor(boxId)!.object3D.add(
      new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    );

    const bounds = binding.worldBounds([emptyId, boxId, "missing"]);

    assert.deepEqual(bounds.min.toArray(), [-1, -1, -1]);
    assert.deepEqual(bounds.max.toArray(), [4, 1, 1]);
    assert.ok(binding.worldBounds(["missing"]).isEmpty());
  });
});
