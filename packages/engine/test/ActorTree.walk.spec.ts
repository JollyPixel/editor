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
  test("should walk from specific node", () => {
    const grandChildActor = createFakeActor();
    const childActor = createFakeActor({
      children: [grandChildActor]
    });
    const rootActor = createFakeActor({
      children: [childActor]
    });

    const actorTree = new ActorTree();

    const walkResult = Array.from(actorTree.walkFromNode(rootActor as any));

    assert.deepEqual(
      walkResult.map((node) => node.actor),
      [childActor, grandChildActor]
    );
  });

  test("should provide correct parent references when walking from node", () => {
    const grandChildActor = createFakeActor();
    const childActor = createFakeActor({
      children: [grandChildActor]
    });
    const rootActor = createFakeActor({
      children: [childActor]
    });

    const actorTree = new ActorTree();

    const walkResult = Array.from(actorTree.walkFromNode(rootActor as any));

    assert.equal(walkResult[0].parent, rootActor);
    assert.equal(walkResult[1].parent, childActor);
  });

  test("should return empty iterator when walking from node with no children", () => {
    const leafActor = createFakeActor();
    const actorTree = new ActorTree();

    const walkResult = Array.from(actorTree.walkFromNode(leafActor as any));

    assert.deepEqual(walkResult, []);
  });

  test("should handle multiple root actors with nested children", () => {
    const child1 = createFakeActor();
    const child2 = createFakeActor();
    const root1 = createFakeActor({
      children: [child1]
    });
    const root2 = createFakeActor({
      children: [child2]
    });

    const actorTree = new ActorTree();
    actorTree.children.push(root1 as any, root2 as any);

    const walkResult = Array.from(actorTree.walk());
    const expectedOrder = [root1, child1, root2, child2];

    assert.deepEqual(
      walkResult.map((node) => node.actor),
      expectedOrder
    );
  });

  test("should be iterable with for...of loop", () => {
    const actors = [createFakeActor(), createFakeActor()];
    const actorTree = new ActorTree();
    actorTree.children.push(...actors as any);

    const collected: any[] = [];
    for (const node of actorTree.walk()) {
      collected.push(node.actor);
    }

    assert.deepEqual(collected, actors);
  });

  test("should support early termination with break", () => {
    const actors = [
      createFakeActor(),
      createFakeActor(),
      createFakeActor()
    ];

    const actorTree = new ActorTree();
    actorTree.children.push(...actors as any);

    const collected: any[] = [];
    for (const node of actorTree.walk()) {
      collected.push(node.actor);
      if (collected.length === 2) {
        break;
      }
    }

    assert.equal(collected.length, 2);
    assert.deepEqual(collected, actors.slice(0, 2));
  });
});
