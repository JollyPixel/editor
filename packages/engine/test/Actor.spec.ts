// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/index.ts";
import { createWorld } from "./mocks.ts";

describe("Actor", () => {
  describe("isDestroyed", () => {
    test("should return true if the actor is marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });
      actor.markDestructionPending();
      assert.strictEqual(actor.isDestroyed(), true);
    });

    test("should return false if the actor is not marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });
      assert.strictEqual(actor.isDestroyed(), false);
    });
  });

  describe("lifecycle", () => {
    test("should call awake on all components", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { awake: mock.fn() };
      actor.components.push(component as any);
      actor.awake();

      assert.strictEqual(component.awake.mock.calls.length, 1);
    });

    test("should call update on components requiring update", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.componentsRequiringUpdate.push(component as any);
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 1);
    });

    test("should not call update on components not in componentsRequiringUpdate", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.push(component as any);
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 0);
    });

    test("should not call update if actor is marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.componentsRequiringUpdate.push(component as any);
      actor.markDestructionPending();
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 0);
    });

    test("should call fixedUpdate on components requiring update", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { fixedUpdate: mock.fn() };
      actor.componentsRequiringUpdate.push(component as any);
      actor.fixedUpdate(0);

      assert.strictEqual(component.fixedUpdate.mock.calls.length, 1);
    });

    test("should not call fixedUpdate if actor is marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { fixedUpdate: mock.fn() };
      actor.componentsRequiringUpdate.push(component as any);
      actor.markDestructionPending();
      actor.fixedUpdate(0);

      assert.strictEqual(component.fixedUpdate.mock.calls.length, 0);
    });

    test("should skip components without fixedUpdate in fixedUpdate loop", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const componentWithUpdate = { update: mock.fn() };
      const componentWithFixed = { fixedUpdate: mock.fn() };
      actor.componentsRequiringUpdate.push(componentWithUpdate as any);
      actor.componentsRequiringUpdate.push(componentWithFixed as any);
      actor.fixedUpdate(0);

      assert.strictEqual(componentWithUpdate.update?.mock.calls.length, 0);
      assert.strictEqual(componentWithFixed.fixedUpdate.mock.calls.length, 1);
    });

    test("should call destroy on all components", () => {
      const world = createWorld();

      const actor = new Actor(world as any, { name: "foobar" });

      const component = { destroy: mock.fn() };
      actor.components.push(component as any);
      actor.destroy();

      assert.strictEqual(component.destroy.mock.calls.length, 1);
      assert.strictEqual(world.sceneManager.tree.remove.mock.calls.length, 1);
      assert.strictEqual(world.sceneManager.tree.remove.mock.calls[0].arguments[0], actor);
    });

    test("should destroy all components even when destroy splices the components array", () => {
      const world = createWorld();
      const actor = new Actor(world as any, { name: "foobar" });

      const destroySpies: ReturnType<typeof mock.fn>[] = [];

      // Create three mock components whose destroy() splices themselves
      // from actor.components, reproducing the real ActorComponent behavior
      for (let i = 0; i < 3; i++) {
        const spy = mock.fn();
        const component = {
          destroy() {
            spy();
            const idx = actor.components.indexOf(this as any);
            if (idx !== -1) {
              actor.components.splice(idx, 1);
            }
          }
        };
        actor.components.push(component as any);
        destroySpies.push(spy);
      }

      assert.strictEqual(actor.components.length, 3);
      actor.destroy();

      assert.strictEqual(actor.components.length, 0);
      for (const spy of destroySpies) {
        assert.strictEqual(spy.mock.calls.length, 1);
      }
    });
  });

  describe("markDestructionPending", () => {
    test("should set the actor's destruction pending flag and notify children", () => {
      const world = createWorld();
      const actor = new Actor(
        world as any,
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

  test("should push actor to the world", () => {
    const world = createWorld();
    const actor = new Actor(
      world as any,
      { name: "foobar" }
    );

    assert.strictEqual(world.sceneManager.tree.add.mock.calls.length, 1);
    assert.strictEqual(world.sceneManager.tree.add.mock.calls[0].arguments[0], actor);
  });
});
