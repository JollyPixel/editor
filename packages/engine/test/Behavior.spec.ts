
// Import Node.js Dependencies
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent,
  Behavior,
  InputListener,
  SceneActorComponent
} from "../src/index.ts";
import { createActor, createWorld } from "./mocks.ts";

describe("Behavior", () => {
  test("should register behavior to actor and add to components to be started", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior = new BehaviorOne(fakeActor);

    assert.deepEqual(fakeActor.components, [behavior]);
    assert.deepEqual(fakeActor.world.sceneManager.componentsToStart, [behavior]);
    assert.deepEqual(fakeActor.behaviors, {
      BehaviorOne: [behavior]
    });
  });

  test("should handle multiple behaviors of same type", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior1 = new BehaviorOne(fakeActor);
    // @ts-expect-error
    const behavior2 = new BehaviorOne(fakeActor);

    assert.deepEqual(fakeActor.components, [behavior1, behavior2]);
    assert.deepEqual(fakeActor.world.sceneManager.componentsToStart, [behavior1, behavior2]);
    assert.deepEqual(fakeActor.behaviors, {
      BehaviorOne: [behavior1, behavior2]
    });
  });

  test("should handle multiple behaviors of different types", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const mockBehavior = new BehaviorOne(fakeActor);
    // @ts-expect-error
    const anotherBehavior = new BehaviorTwo(fakeActor);

    assert.deepEqual(fakeActor.components, [mockBehavior, anotherBehavior]);
    assert.deepEqual(fakeActor.world.sceneManager.componentsToStart, [mockBehavior, anotherBehavior]);
    assert.deepEqual(fakeActor.behaviors, {
      BehaviorOne: [mockBehavior],
      BehaviorTwo: [anotherBehavior]
    });
  });

  test("should remove behavior from actor on destroy", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior = new BehaviorOne(fakeActor);

    assert.equal(fakeActor.components.length, 1);
    assert.equal(Object.keys(fakeActor.behaviors).length, 1);

    behavior.destroy();

    assert.equal(fakeActor.components.length, 0);
    assert.equal(Object.keys(fakeActor.behaviors).length, 0);
  });

  test("should handle destroy when multiple behaviors of same type exist", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior1 = new BehaviorOne(fakeActor);
    // @ts-expect-error
    const behavior2 = new BehaviorOne(fakeActor);

    assert.equal(fakeActor.components.length, 2);
    const behaviorList = fakeActor.behaviors.BehaviorOne;
    assert.equal(behaviorList.length, 2);

    behavior1.destroy();

    assert.equal(fakeActor.components.length, 1);
    assert.equal(fakeActor.components[0], behavior2);
    assert.deepEqual(behaviorList, [behavior2]);
  });

  test("should not affect other behavior types on destroy", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const mockBehavior = new BehaviorOne(fakeActor);
    // @ts-expect-error
    const anotherBehavior = new BehaviorTwo(fakeActor);

    mockBehavior.destroy();

    assert.equal(fakeActor.components.length, 1);
    assert.equal(fakeActor.components[0], anotherBehavior);
    assert.equal(Object.keys(fakeActor.behaviors).length, 1);
    assert.deepEqual(fakeActor.behaviors.BehaviorTwo, [anotherBehavior]);
  });

  test("should handle destroy on already destroyed behavior", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior = new BehaviorOne(fakeActor);

    behavior.destroy();
    assert.equal(fakeActor.components.length, 0);

    // Should not throw or cause issues
    behavior.destroy();
    assert.equal(fakeActor.components.length, 0);
  });

  test("should still tear down a behavior already marked for destruction", () => {
    const fakeActor = createActor();

    // @ts-expect-error
    const behavior = new BehaviorOne(fakeActor);
    behavior.pendingForDestruction = true;
    behavior.destroy();

    assert.equal(fakeActor.components.length, 0);
    assert.equal(Object.keys(fakeActor.behaviors).length, 0);
  });
});

describe("Actor Component Lookup", () => {
  describe("getComponent", () => {
    test("should return the correct behavior instance", () => {
      const actor = createRealActor();

      const behavior = new BehaviorOne(actor);

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, behavior);
    });

    test("should return null if behavior does not exist", () => {
      const actor = createRealActor();

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, null);
    });

    test("should return the first instance of the behavior if multiple exist", () => {
      const actor = createRealActor();

      const behavior1 = new BehaviorOne(actor);
      new BehaviorOne(actor);

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, behavior1);
    });

    test("should skip destroyed behaviors", () => {
      const actor = createRealActor();

      const destroyedBehavior = new BehaviorOne(actor);
      const validBehavior = new BehaviorOne(actor);

      destroyedBehavior.pendingForDestruction = true;

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, validBehavior);
    });

    test("should find behavior by inheritance", () => {
      const actor = createRealActor();

      const childBehavior = new ChildBehavior(actor);

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, childBehavior);
    });

    test("should return null when all behaviors are destroyed", () => {
      const actor = createRealActor();

      const behavior1 = new BehaviorOne(actor);
      const behavior2 = new BehaviorOne(actor);

      behavior1.pendingForDestruction = true;
      behavior2.pendingForDestruction = true;

      const retrievedBehavior = actor.getComponent(BehaviorOne);
      assert.equal(retrievedBehavior, null);
    });
  });

  describe("getComponents", () => {
    test("should return all instances of the behavior", () => {
      const actor = createRealActor();

      const behavior1 = new BehaviorOne(actor);
      const behavior2 = new BehaviorOne(actor);

      const retrievedBehaviors = Array.from(actor.getComponents(BehaviorOne));
      assert.deepEqual(retrievedBehaviors, [behavior1, behavior2]);
    });

    test("should return an empty array if no behaviors exist", () => {
      const actor = createRealActor();

      const retrievedBehaviors = Array.from(actor.getComponents(BehaviorOne));
      assert.deepEqual(retrievedBehaviors, []);
    });

    test("should return all instances of different behaviors", () => {
      const actor = createRealActor();

      const behavior1 = new BehaviorOne(actor);
      const behavior2 = new BehaviorTwo(actor);

      const retrievedBehaviorsOne = Array.from(actor.getComponents(BehaviorOne));
      const retrievedBehaviorsTwo = Array.from(actor.getComponents(BehaviorTwo));

      assert.deepEqual(retrievedBehaviorsOne, [behavior1]);
      assert.deepEqual(retrievedBehaviorsTwo, [behavior2]);
    });

    test("should exclude destroyed behaviors", () => {
      const actor = createRealActor();

      const validBehavior1 = new BehaviorOne(actor);
      const destroyedBehavior = new BehaviorOne(actor);
      const validBehavior2 = new BehaviorOne(actor);

      destroyedBehavior.pendingForDestruction = true;

      const retrievedBehaviors = Array.from(actor.getComponents(BehaviorOne));
      assert.deepEqual(retrievedBehaviors, [validBehavior1, validBehavior2]);
    });

    test("should find all behaviors by inheritance", () => {
      const actor = createRealActor();

      const parentBehavior = new BehaviorOne(actor);
      const childBehavior1 = new ChildBehavior(actor);
      const childBehavior2 = new ChildBehavior(actor);

      const retrievedBehaviors = Array.from(actor.getComponents(BehaviorOne));
      assert.equal(retrievedBehaviors.length, 3);
      assert.ok(retrievedBehaviors.includes(parentBehavior));
      assert.ok(retrievedBehaviors.includes(childBehavior1));
      assert.ok(retrievedBehaviors.includes(childBehavior2));
    });

    test("should handle inheritance with destroyed behaviors", () => {
      const actor = createRealActor();

      const parentBehavior = new BehaviorOne(actor);
      const childBehavior = new ChildBehavior(actor);

      parentBehavior.pendingForDestruction = true;

      const retrievedBehaviors = Array.from(actor.getComponents(BehaviorOne));
      assert.deepEqual(retrievedBehaviors, [childBehavior]);
    });
  });
});

describe("Behavior bindings", () => {
  test("should resolve decorated sibling components before awake", () => {
    const actor = createRealActor();
    const consumer = actor.addComponentAndGet(SiblingConsumer);
    const sibling = actor.addComponentAndGet(Sibling);

    actor.awake();

    assert.strictEqual(consumer.siblingSeenInAwake, sibling);
  });

  test("should resolve bindings immediately when added to an awoken actor", () => {
    const actor = createRealActor();
    const sibling = actor.addComponentAndGet(Sibling);
    actor.awake();

    const consumer = actor.addComponentAndGet(SiblingConsumer);

    assert.strictEqual(consumer.siblingSeenInAwake, sibling);
  });

  test("should unsubscribe input listeners on destroy", () => {
    const keyboard = {
      on: mock.fn(),
      off: mock.fn()
    };
    const actor = new Actor(
      { ...createWorld(), input: { keyboard } } as any,
      { name: "test" }
    );
    const listener = actor.addComponentAndGet(KeyListener);
    actor.awake();

    assert.strictEqual(keyboard.on.mock.callCount(), 1);
    const [eventName, handler] = keyboard.on.mock.calls[0].arguments;
    assert.strictEqual(eventName, "down");

    listener.destroy();

    assert.strictEqual(keyboard.off.mock.callCount(), 1);
    assert.deepEqual(keyboard.off.mock.calls[0].arguments, [eventName, handler]);
  });
});

class Sibling extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Sibling" });
  }
}

class SiblingConsumer extends Behavior {
  sibling: Sibling | undefined = undefined;
  siblingSeenInAwake: Sibling | undefined = undefined;

  awake() {
    this.siblingSeenInAwake = this.sibling;
  }
}
SceneActorComponent(Sibling)(SiblingConsumer.prototype, "sibling");

class KeyListener extends Behavior {
  onKeyDown() {
    return;
  }
}
InputListener("keyboard.down")(KeyListener.prototype, "onKeyDown");

class BehaviorOne extends Behavior {}
class BehaviorTwo extends Behavior {}
class ChildBehavior extends BehaviorOne {}

function createRealActor() {
  return new Actor(
    createWorld() as any,
    { name: "test" }
  );
}
