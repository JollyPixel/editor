// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Actor,
  Behavior
} from "../src/index.ts";
import { SceneManager } from "../src/systems/scene/SceneManager.ts";

class BehaviorOne extends Behavior {
  starts = 0;

  start() {
    this.starts++;
  }
}
class BehaviorTwo extends Behavior {}

function createActor() {
  const sceneManager = new SceneManager();
  const actor = new Actor(
    { sceneManager } as any,
    { name: "owner" }
  );

  return { actor, sceneManager };
}

describe("Behavior", () => {
  test("should register on its actor and start on the next frame", () => {
    const { actor, sceneManager } = createActor();

    const behavior = new BehaviorOne(actor);

    assert.deepEqual(actor.components, [behavior]);
    assert.strictEqual(behavior.starts, 0);

    sceneManager.beginFrame();
    sceneManager.beginFrame();
    assert.strictEqual(behavior.starts, 1);
  });

  test("should group behaviors by type name on the actor", () => {
    const { actor } = createActor();

    const first = new BehaviorOne(actor);
    const second = new BehaviorOne(actor);
    const other = new BehaviorTwo(actor);

    assert.deepEqual(actor.components, [first, second, other]);
    assert.deepEqual(actor.behaviors, {
      BehaviorOne: [first, second],
      BehaviorTwo: [other]
    });
  });

  test("should remove behavior from actor on destroy", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);

    assert.equal(actor.components.length, 1);
    assert.equal(Object.keys(actor.behaviors).length, 1);

    behavior.destroy();

    assert.equal(actor.components.length, 0);
    assert.equal(Object.keys(actor.behaviors).length, 0);
  });

  test("should handle destroy when multiple behaviors of same type exist", () => {
    const { actor } = createActor();

    const behavior1 = new BehaviorOne(actor);
    const behavior2 = new BehaviorOne(actor);

    assert.equal(actor.components.length, 2);
    const behaviorList = actor.behaviors.BehaviorOne;
    assert.equal(behaviorList.length, 2);

    behavior1.destroy();

    assert.equal(actor.components.length, 1);
    assert.equal(actor.components[0], behavior2);
    assert.deepEqual(behaviorList, [behavior2]);
  });

  test("should not affect other behavior types on destroy", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);
    const anotherBehavior = new BehaviorTwo(actor);

    behavior.destroy();

    assert.equal(actor.components.length, 1);
    assert.equal(actor.components[0], anotherBehavior);
    assert.equal(Object.keys(actor.behaviors).length, 1);
    assert.deepEqual(actor.behaviors.BehaviorTwo, [anotherBehavior]);
  });

  test("should handle destroy on already destroyed behavior", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);

    behavior.destroy();
    assert.equal(actor.components.length, 0);

    behavior.destroy();
    assert.equal(actor.components.length, 0);
  });

  test("should still tear down a behavior already marked for destruction", () => {
    const { actor } = createActor();

    const behavior = new BehaviorOne(actor);
    behavior.pendingForDestruction = true;
    behavior.destroy();

    assert.equal(actor.components.length, 0);
    assert.equal(Object.keys(actor.behaviors).length, 0);
  });
});
