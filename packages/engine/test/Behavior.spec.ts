// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent,
  Behavior,
  InputListener,
  SceneActorComponent
} from "../src/index.ts";
import { createActor } from "./mocks.ts";

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
