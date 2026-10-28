// Import Node.js Dependencies
import {
  describe,
  test,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor, ActorComponent } from "../src/actor/index.ts";
import { SceneManager } from "../src/systems/scene/SceneManager.ts";

class Health extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Health" });
  }
}

class Weapon extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Weapon" });
  }
}

function createActors() {
  const sceneManager = new SceneManager();
  const world = { sceneManager } as any;

  return {
    sceneManager,
    createActor(
      name: string,
      parent: Actor | null = null
    ) {
      return new Actor(world, { name, parent });
    }
  };
}

describe("Actor components", () => {
  test("reports a component by class or type name until it is removed", () => {
    const { createActor } = createActors();
    const actor = createActor("hero").addComponent(Health);

    assert.strictEqual(actor.hasComponent(Health), true);
    assert.strictEqual(actor.hasComponent("Health"), true);
    assert.strictEqual(actor.hasComponent(Weapon), false);

    actor.removeComponent(Health);

    assert.strictEqual(actor.hasComponent(Health), false);
  });

  test("removes a component at the end of the frame", () => {
    const { sceneManager, createActor } = createActors();
    const actor = createActor("hero");
    const health = actor.addComponentAndGet(Health);
    const destroy = mock.method(health, "destroy");

    assert.strictEqual(actor.removeComponent(health), true);
    assert.strictEqual(actor.removeComponent(health), false);
    assert.strictEqual(destroy.mock.callCount(), 0);

    sceneManager.endFrame();

    assert.strictEqual(destroy.mock.callCount(), 1);
    assert.deepEqual([...actor.components], []);
  });

  test("ensures a component by returning the live one or adding a new one", () => {
    const { createActor } = createActors();
    const actor = createActor("hero");
    const health = actor.addComponentAndGet(Health);

    assert.strictEqual(actor.ensureComponent(Health), health);

    const weapon = actor.ensureComponent(Weapon);

    assert.ok(weapon instanceof Weapon);
    assert.deepEqual([...actor.components], [health, weapon]);
  });

  test("finds the nearest component among descendants or ancestors, never on itself", () => {
    const { createActor } = createActors();
    const root = createActor("root").addComponent(Health);
    const arm = createActor("arm", root);
    const hand = createActor("hand", arm).addComponent(Weapon);
    const sword = hand.getComponent(Weapon);

    assert.strictEqual(root.findComponentInChildren(Weapon), sword);
    assert.strictEqual(root.findComponentInChildren(Health), null);
    assert.strictEqual(hand.findComponentInParent(Health), root.getComponent(Health));
    assert.strictEqual(hand.findComponentInParent(Weapon), null);
  });
});

describe("Actor hierarchy", () => {
  test("names the root of an actor and the actors below it", () => {
    const { createActor } = createActors();
    const root = createActor("root");
    const arm = createActor("arm", root);
    const hand = createActor("hand", arm);
    const other = createActor("other");

    assert.strictEqual(hand.root, root);
    assert.strictEqual(root.root, root);
    assert.strictEqual(root.hasDescendant(hand), true);
    assert.strictEqual(hand.hasDescendant(root), false);
    assert.strictEqual(other.hasDescendant(hand), false);
  });

  test("reports itself destroyed once destroyed, and destroys only once", () => {
    const { createActor } = createActors();
    const actor = createActor("hero");
    const onDestroy = mock.fn();
    actor.addComponentAndGet(Health).addTeardown(onDestroy);

    actor.destroy();
    actor.destroy();

    assert.strictEqual(actor.pendingForDestruction, true);
    assert.strictEqual(onDestroy.mock.callCount(), 1);
  });
});
