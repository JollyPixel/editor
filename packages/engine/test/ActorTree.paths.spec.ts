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

describe("ActorTree path patterns", () => {
  function createTree() {
    const weapon = createFakeActor({ name: "Weapon" });
    const hand = createFakeActor({ name: "RightHand", children: [weapon] });
    const mesh = createFakeActor({ name: "Mesh_Body" });
    const body = createFakeActor({ name: "Body", children: [mesh, hand] });
    const player = createFakeActor({ name: "Player", children: [body] });
    const tree = new ActorTree();
    tree.children.push(player as any);

    return { tree, player, body, hand, weapon, mesh };
  }

  function names(
    actors: Iterable<{ name: string; }>
  ): string[] {
    return [...actors].map((actor) => actor.name);
  }

  test("should match a path that continues after a double star", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.getActors("**/RightHand/Weapon")), ["Weapon"]);
  });

  test("should match a glob segment after a double star", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.getActors("Player/**/Mesh_*")), ["Mesh_Body"]);
  });

  test("should match single-level globs along a path", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.getActors("Player/*/RightHand")), ["RightHand"]);
  });

  test("should skip pending actors inside a path", () => {
    const { tree, hand } = createTree();
    hand.pendingForDestruction = true;

    assert.deepEqual(names(tree.getActors("**/RightHand/Weapon")), []);
  });

  test("should anchor getActor paths at the root actors", () => {
    const { tree, weapon } = createTree();

    assert.equal(tree.getActor("Player/Body/RightHand/Weapon"), weapon);
    assert.equal(tree.getActor("RightHand/Weapon"), null);
  });

  test("should not resolve a path through a pending actor", () => {
    const { tree, body } = createTree();
    body.pendingForDestruction = true;

    assert.equal(tree.getActor("Player/Body/RightHand"), null);
  });
});
