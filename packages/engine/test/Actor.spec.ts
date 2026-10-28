// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/index.ts";
import { createWorld } from "./helpers/actor/mockWorld.ts";

describe("Actor", () => {
  describe("status", () => {
    test("should move from alive to pending to destroyed", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });
      const statuses = [actor.status];

      actor.markDestructionPending();
      statuses.push(actor.status);
      actor.destroy();
      actor.markDestructionPending();
      statuses.push(actor.status);

      assert.deepStrictEqual(statuses, ["alive", "pending", "destroyed"]);
    });
  });

  describe("lifecycle", () => {
    test("should call awake on all components", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { awake: mock.fn() };
      actor.components.attach(component as any);
      actor.awake();

      assert.strictEqual(component.awake.mock.calls.length, 1);
    });

    test("should awake components added during awake", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const secondAwake = mock.fn();
      const firstComponent = {
        awake: mock.fn(() => {
          actor.components.attach({ awake: secondAwake } as any);
        })
      };
      actor.components.attach(firstComponent as any);

      actor.awake();

      assert.strictEqual(firstComponent.awake.mock.calls.length, 1);
      assert.strictEqual(secondAwake.mock.calls.length, 1);
    });

    test("should call update on components requiring update", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.requireUpdate(component as any, true);
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 1);
    });

    test("should not call update on components not in componentsRequiringUpdate", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.attach(component as any);
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 0);
    });

    test("should not call update if actor is marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { update: mock.fn() };
      actor.components.requireUpdate(component as any, true);
      actor.markDestructionPending();
      actor.update(0);

      assert.strictEqual(component.update.mock.calls.length, 0);
    });

    test("should call fixedUpdate on components requiring update", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { fixedUpdate: mock.fn() };
      actor.components.requireUpdate(component as any, true);
      actor.fixedUpdate(0);

      assert.strictEqual(component.fixedUpdate.mock.calls.length, 1);
    });

    test("should not call fixedUpdate if actor is marked for destruction", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const component = { fixedUpdate: mock.fn() };
      actor.components.requireUpdate(component as any, true);
      actor.markDestructionPending();
      actor.fixedUpdate(0);

      assert.strictEqual(component.fixedUpdate.mock.calls.length, 0);
    });

    test("should skip components without fixedUpdate in fixedUpdate loop", () => {
      const actor = new Actor(createWorld() as any, { name: "foobar" });

      const componentWithUpdate = { update: mock.fn() };
      const componentWithFixed = { fixedUpdate: mock.fn() };
      actor.components.requireUpdate(componentWithUpdate as any, true);
      actor.components.requireUpdate(componentWithFixed as any, true);
      actor.fixedUpdate(0);

      assert.strictEqual(componentWithUpdate.update?.mock.calls.length, 0);
      assert.strictEqual(componentWithFixed.fixedUpdate.mock.calls.length, 1);
    });

    test("should call destroy on all components", () => {
      const world = createWorld();

      const actor = new Actor(world as any, { name: "foobar" });

      const component = { destroy: mock.fn() };
      actor.components.attach(component as any);
      actor.destroy();

      assert.strictEqual(component.destroy.mock.calls.length, 1);
      assert.deepStrictEqual(world.sceneManager.tree.children, []);
    });

    test("should destroy all components even when destroy splices the components array", () => {
      const world = createWorld();
      const actor = new Actor(world as any, { name: "foobar" });

      const destroySpies: ReturnType<typeof mock.fn>[] = [];

      for (let i = 0; i < 3; i++) {
        const spy = mock.fn();
        const component = {
          destroy() {
            spy();
            actor.components.detach(this as any);
          }
        };
        actor.components.attach(component as any);
        destroySpies.push(spy);
      }

      assert.strictEqual([...actor.components].length, 3);
      actor.destroy();

      assert.strictEqual([...actor.components].length, 0);
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

  test("should rename its object with it", () => {
    const actor = new Actor(
      createWorld() as any,
      { name: "foobar" }
    );

    actor.name = "renamed";

    assert.strictEqual(actor.object3D.name, "renamed");
    assert.strictEqual(actor.name, "renamed");
  });
});
