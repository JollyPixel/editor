// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  createSceneEnvironment,
  SceneDocument,
  type SceneEnvironmentJSON
} from "@jolly-pixel/asset.scene/client";
import {
  ActorComponent,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { SceneBinding } from "../../src/scene/SceneBinding.ts";
import { createEditWorld } from "../helpers/editWorld.ts";

class Probe extends ActorComponent {
  label: string;

  constructor(
    actor: Actor,
    options: { label: string; }
  ) {
    super({ actor, typeName: "Probe" });
    this.label = options.label;
  }
}

function parseLabel(
  data: Readonly<Systems.JSONObject>
): string {
  return typeof data.label === "string" ? data.label : "none";
}

const kPatched: Systems.ComponentDefinition<string, Probe> = {
  type: "Patched",
  parse: parseLabel,
  create: (actor, label) => actor.addComponentAndGet(Probe, { label }),
  apply: (probe, label) => {
    probe.label = label;
  }
};

const kRebuilt: Systems.ComponentDefinition<string, Probe> = {
  type: "Rebuilt",
  parse: parseLabel,
  create: (actor, label) => actor.addComponentAndGet(Probe, { label })
};

function createBinding(
  document: SceneDocument
) {
  const { world, sceneManager } = createEditWorld();
  const environments: SceneEnvironmentJSON[] = [];
  const binding = new SceneBinding({
    world,
    document,
    components: new Systems.ComponentDefinitions().register(kPatched, kRebuilt),
    assets: {
      resolve: () => {
        throw new Error("No asset expected");
      }
    },
    environment: {
      apply: (environment) => environments.push(environment)
    }
  });

  return { binding, sceneManager, environments };
}

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

    const { binding, environments } = createBinding(document);

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
    const { binding, sceneManager } = createBinding(document);

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
    const { binding } = createBinding(document);
    const patched = binding.component("patched");
    const rebuilt = binding.component("rebuilt");

    document.changeComponent("patched", { data: { label: "b" } });
    document.changeComponent("rebuilt", { data: { label: "b" } });

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
    const { binding } = createBinding(document);

    document.move(childId, null, {
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

  test("rebuilds every actor and the environment when the document resets", () => {
    const document = new SceneDocument();
    const oldId = document.addActor({ name: "Old" })!;
    const { binding, sceneManager, environments } = createBinding(document);
    const foggy: SceneEnvironmentJSON = {
      ...createSceneEnvironment(),
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

  test("finds the actor that owns a nested object", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor" })!;
    const { binding } = createBinding(document);
    const mesh = new THREE.Object3D();
    binding.actor(actorId)!.object3D.add(mesh);

    assert.strictEqual(binding.findActorId(mesh), actorId);
    assert.strictEqual(binding.findActorId(new THREE.Object3D()), null);
  });

  test("resolves an outside pick target to its actor until it is released", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor" })!;
    const { binding } = createBinding(document);
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
    const { binding } = createBinding(document);
    const live = new Set([...binding.components()].map(({ component }) => component));
    binding.on("componentBuilt", ({ component, actorId: ownerId }) => {
      assert.strictEqual(ownerId, actorId);
      live.add(component);
    });
    binding.on("componentDropped", (component) => live.delete(component));

    document.changeComponent("rebuilt", { data: { label: "b" } });
    assert.deepEqual([...live], [binding.component("rebuilt")]);

    document.remove(actorId);
    assert.deepEqual([...live], []);
  });
});
