// Import Node.js Dependencies
import {
  describe,
  test,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ActorTree } from "../src/index.ts";

function createFakeActor(
  options: { children?: any[]; name?: string; } = {}
) {
  const { children = [], name = "" } = options;

  return {
    name,
    children,
    pendingForDestruction: false,
    markDestructionPending: mock.fn()
  };
}

describe("ActorTree", () => {
  describe("add", () => {
    test("should add a new root actor to the tree", () => {
      const actorTree = new ActorTree();
      const actor = {} as any;

      actorTree.add(actor);

      assert.ok(actorTree.children.includes(actor));
      assert.equal(actorTree.children.length, 1);
    });

    test("should call addCallback when adding a new root actor", () => {
      const addCallback = mock.fn();

      const actorTree = new ActorTree({
        addCallback
      });
      const actor = {} as any;

      actorTree.add(actor);

      assert.equal(addCallback.mock.calls.length, 1);
      assert.equal(addCallback.mock.calls[0].arguments[0], actor);
    });
  });

  describe("remove", () => {
    test("should remove existing actor from the tree", () => {
      const actorTree = new ActorTree();
      const actor = {} as any;

      actorTree.add(actor);
      assert.equal(actorTree.children.length, 1);

      actorTree.remove(actor);

      assert.equal(actorTree.children.length, 0);
      assert.ok(!actorTree.children.includes(actor));
    });

    test("should call removeCallback when removing an actor", () => {
      const removeCallback = mock.fn();
      const actorTree = new ActorTree({
        removeCallback
      });
      const actor = {} as any;

      actorTree.add(actor);
      actorTree.remove(actor);

      assert.equal(removeCallback.mock.calls.length, 1);
      assert.equal(removeCallback.mock.calls[0].arguments[0], actor);
    });

    test("should handle removing non-existent actor", () => {
      const removeCallback = mock.fn();
      const actorTree = new ActorTree({
        removeCallback
      });
      const actor1 = {} as any;
      const actor2 = {} as any;

      actorTree.add(actor1);

      actorTree.remove(actor2);

      assert.equal(actorTree.children.length, 1);
      assert.equal(removeCallback.mock.calls.length, 0);
    });
  });

  describe("getActor", () => {
    test("should find actor by name", () => {
      const actorTree = new ActorTree();
      const targetActor = createFakeActor({
        name: "Player"
      });
      const otherActor = createFakeActor({
        name: "Enemy"
      });

      // @ts-expect-error
      actorTree.children.push(targetActor, otherActor);

      const result = actorTree.getActor("Player");
      assert.equal(result, targetActor);
    });

    test("should return null for non-existent actor", () => {
      const actorTree = new ActorTree();
      const actor = createFakeActor({
        name: "Player"
      });

      // @ts-expect-error
      actorTree.children.push(actor);

      const result = actorTree.getActor("NonExistent");
      assert.equal(result, null);
    });

    test("should ignore actors pending destruction", () => {
      const actorTree = new ActorTree();
      const actor = createFakeActor({
        name: "Player"
      });
      actor.pendingForDestruction = true;

      // @ts-expect-error
      actorTree.children.push(actor);

      const result = actorTree.getActor("Player");
      assert.equal(result, null);
    });
  });

  describe("getRootActors", () => {
    test("should yield only non-destroyed root actors", () => {
      const actorTree = new ActorTree();
      const validActor = createFakeActor();
      const destroyedActor = createFakeActor();
      destroyedActor.pendingForDestruction = true;

      // @ts-expect-error
      actorTree.children.push(validActor, destroyedActor);

      const result = Array.from(actorTree.getRootActors());
      assert.deepEqual(result, [validActor]);
    });

    test("should return empty iterator when no valid actors", () => {
      const actorTree = new ActorTree();
      const destroyedActor = createFakeActor();
      destroyedActor.pendingForDestruction = true;

      // @ts-expect-error
      actorTree.children.push(destroyedActor);

      const result = Array.from(actorTree.getRootActors());
      assert.deepEqual(result, []);
    });
  });

  describe("getAllActors", () => {
    test("should yield all actors including children", () => {
      const actorTree = new ActorTree();
      const child = createFakeActor();
      const parent = createFakeActor({
        children: [child]
      });

      // @ts-expect-error
      actorTree.children.push(parent);

      const result = Array.from(actorTree.getAllActors());
      assert.deepEqual(result, [parent, child]);
    });
  });

  describe("destroyActor", () => {
    test("should mark actor for destruction and add to destroy list", () => {
      const actorTree = new ActorTree();
      const actor = createFakeActor();

      // @ts-expect-error
      actorTree.destroyActor(actor);

      assert.equal(actor.markDestructionPending.mock.calls.length, 1);
    });

    test("should not add already pending actor", () => {
      const actorTree = new ActorTree();
      const actor = createFakeActor();
      actor.pendingForDestruction = true;

      // @ts-expect-error
      actorTree.destroyActor(actor);

      assert.equal(actor.markDestructionPending.mock.calls.length, 0);
    });
  });

  test("should walk and return all root actors", () => {
    const actors = [
      createFakeActor(),
      createFakeActor(),
      createFakeActor()
    ];

    const actorTree = new ActorTree();
    actorTree.children.push(...actors as any);

    assert.deepEqual(
      Array.from(actorTree.walk()).map((node) => node.actor),
      actors
    );
  });

  test("should walk nested actors depth-first", () => {
    const grandChildActor = createFakeActor();
    const childActor1 = createFakeActor({
      children: [grandChildActor]
    });
    const childActor2 = createFakeActor();
    const rootActor = createFakeActor({
      children: [childActor1, childActor2]
    });

    const actorTree = new ActorTree();
    actorTree.children.push(rootActor as any);

    const walkResult = Array.from(actorTree.walk());
    const expectedOrder = [rootActor, childActor1, grandChildActor, childActor2];

    assert.deepEqual(
      walkResult.map((node) => node.actor),
      expectedOrder
    );
  });

  test("should provide correct parent references when walking", () => {
    const grandChildActor = createFakeActor();
    const childActor = createFakeActor({
      children: [grandChildActor]
    });
    const rootActor = createFakeActor({
      children: [childActor]
    });

    const actorTree = new ActorTree();
    actorTree.children.push(rootActor as any);

    const walkResult = Array.from(actorTree.walk());

    assert.equal(walkResult[0].parent, undefined);
    assert.equal(walkResult[1].parent, rootActor);
    assert.equal(walkResult[2].parent, childActor);
  });

  test("should return empty iterator when tree is empty", () => {
    const actorTree = new ActorTree();
    const walkResult = Array.from(actorTree.walk());

    assert.deepEqual(walkResult, []);
  });
});
