// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createHeadlessWorld } from "./helpers/world/headlessWorld.ts";

describe("ActorTree path patterns", () => {
  function createTree() {
    const world = createHeadlessWorld();
    const player = world.createActor("Player");
    const body = world.createActor("Body", { parent: player });
    const mesh = world.createActor("Mesh_Body", { parent: body });
    const hand = world.createActor("RightHand", { parent: body });
    const weapon = world.createActor("Weapon", { parent: hand });
    const { tree } = world.sceneManager;

    return { tree, player, body, hand, weapon, mesh };
  }

  function names(
    actors: Iterable<{ name: string; }>
  ): string[] {
    return [...actors].map((actor) => actor.name);
  }

  test("should match a path that continues after a double star", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.findActors("**/RightHand/Weapon")), ["Weapon"]);
  });

  test("should match a glob segment after a double star", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.findActors("Player/**/Mesh_*")), ["Mesh_Body"]);
  });

  test("should match a name glob at any depth, with dots read literally", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.findActors("Mesh_*")), ["Mesh_Body"]);
    assert.deepEqual(names(tree.findActors("?ody")), ["Body"]);
    assert.deepEqual(names(tree.findActors("B.dy")), []);
  });

  test("should match single-level globs along a path", () => {
    const { tree } = createTree();

    assert.deepEqual(names(tree.findActors("Player/*/RightHand")), ["RightHand"]);
  });

  test("should skip pending actors inside a path", () => {
    const { tree, hand } = createTree();
    hand.markDestructionPending();

    assert.deepEqual(names(tree.findActors("**/RightHand/Weapon")), []);
  });

  test("should anchor findActor paths at the root actors", () => {
    const { tree, weapon } = createTree();

    assert.equal(tree.findActor("Player/Body/RightHand/Weapon"), weapon);
    assert.equal(tree.findActor("RightHand/Weapon"), null);
  });

  test("should not resolve a path through a pending actor", () => {
    const { tree, body } = createTree();
    body.markDestructionPending();

    assert.equal(tree.findActor("Player/Body/RightHand"), null);
  });
});
