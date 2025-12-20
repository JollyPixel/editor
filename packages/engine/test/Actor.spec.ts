// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/index.ts";
import { createGameInstance } from "./mocks.ts";

describe("Actor", () => {
  describe("isDestroyed", () => {
    test("should return true if the actor is marked for destruction", () => {
      const actor = new Actor(createGameInstance() as any, { name: "foobar" });
      actor.markDestructionPending();
      assert.strictEqual(actor.isDestroyed(), true);
    });

    test("should return false if the actor is not marked for destruction", () => {
      const actor = new Actor(createGameInstance() as any, { name: "foobar" });
      assert.strictEqual(actor.isDestroyed(), false);
    });
  });

  describe("lifecycle", () => {
    test("should call awake on all components", () => {
      const actor = new Actor(createGameInstance() as any, { name: "foobar" });

      const component = { awake: mock.fn() };
      actor.components.push(component as any);
      actor.awake();

      assert.strictEqual(component.awake.mock.calls.length, 1);
    });

    test("should call update on all components", () => {
      const actor = new Actor(createGameInstance() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.push(component as any);
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 1);
    });

    test("should not call update if actor is marked for destruction", () => {
      const actor = new Actor(createGameInstance() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.push(component as any);
      actor.markDestructionPending();
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 0);
    });

    test("should call destroy on all components", () => {
      const gameInstance = createGameInstance();

      const actor = new Actor(gameInstance as any, { name: "foobar" });

      const component = { destroy: mock.fn() };
      actor.components.push(component as any);
      actor.destroy();

      assert.strictEqual(component.destroy.mock.calls.length, 1);
      assert.strictEqual(gameInstance.scene.tree.remove.mock.calls.length, 1);
      assert.strictEqual(gameInstance.scene.tree.remove.mock.calls[0].arguments[0], actor);
    });
  });

  describe("markDestructionPending", () => {
    test("should set the actor's destruction pending flag and notify children", () => {
      const gameInstance = createGameInstance();
      const actor = new Actor(
        gameInstance as any,
        { name: "foobar" }
      );
      const fakeActorChildren = {
        children: [],
        markDestructionPending: mock.fn()
      };

      actor.add(fakeActorChildren as any);
      actor.add(fakeActorChildren as any);
      actor.markDestructionPending();

      assert.strictEqual(actor.pendingForDestruction, true);
      assert.strictEqual(fakeActorChildren.markDestructionPending.mock.calls.length, 2);
    });
  });

  test("should push actor to the game instance", () => {
    const gameInstance = createGameInstance();
    const actor = new Actor(
      gameInstance as any,
      { name: "foobar" }
    );

    assert.strictEqual(gameInstance.scene.tree.add.mock.calls.length, 1);
    assert.strictEqual(gameInstance.scene.tree.add.mock.calls[0].arguments[0], actor);
  });
});
