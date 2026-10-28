// Import Node.js Dependencies
import {
  describe,
  test,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";
import { Actor, ActorComponent } from "../../../src/actor/index.ts";

// CONSTANTS
const kDeltaTime = 16.67;

class Recorder extends ActorComponent {
  calls: string[] = [];

  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Recorder" });
  }

  awake() {
    this.calls.push("awake");
  }

  start() {
    this.calls.push("start");
  }

  fixedUpdate() {
    this.calls.push("fixedUpdate");
  }

  update() {
    this.calls.push("update");
  }
}

class Logger extends ActorComponent {
  #log: string[];
  onUpdate: () => void = () => undefined;

  constructor(
    actor: Actor,
    log: string[]
  ) {
    super({ actor, typeName: "Logger" });
    this.#log = log;
  }

  update() {
    this.#log.push(this.actor.name);
    this.onUpdate();
  }
}

function createRegistry() {
  const root = new THREE.Scene();
  const sceneManager = new SceneManager(root);
  const world = { sceneManager } as any;

  return {
    root,
    registry: sceneManager.actors,
    createActor(name: string, parent: Actor | null = null) {
      return new Actor(world, { name, parent });
    }
  };
}

describe("Systems.Scene.ActorRegistry", () => {
  test("should place root actors on the scene root and take them off once destroyed", () => {
    const { root, registry, createActor } = createRegistry();
    const actor = createActor("root");
    const child = createActor("child", actor);

    assert.deepStrictEqual(root.children, [actor.object3D]);
    assert.strictEqual(child.object3D.parent, actor.object3D);

    actor.destroy();

    assert.deepStrictEqual(root.children, []);
    assert.strictEqual(registry.has(child), false);
  });

  test("should awake, then start, a component on the frame after its actor appears", () => {
    const { registry, createActor } = createRegistry();
    registry.awake();
    const recorder = createActor("late").addComponentAndGet(Recorder);

    registry.beginFrame();
    registry.beginFrame();

    assert.deepStrictEqual(recorder.calls, ["awake", "start"]);
  });

  test("should run fixed steps and the update of every actor of the frame", () => {
    const { registry, createActor } = createRegistry();
    const first = createActor("first").addComponentAndGet(Recorder);
    const second = createActor("second").addComponentAndGet(Recorder);
    registry.beginFrame();

    registry.fixedUpdate(kDeltaTime, 0);
    registry.fixedUpdate(kDeltaTime, 1);
    registry.update(kDeltaTime, 0);

    for (const recorder of [first, second]) {
      assert.deepStrictEqual(
        recorder.calls,
        ["awake", "start", "fixedUpdate", "fixedUpdate", "update"]
      );
    }
  });

  test("should update actors in creation order, even one that starts updating late", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    const late = createActor("late");
    createActor("early").addComponent(Logger, log);
    registry.beginFrame();

    late.addComponent(Logger, log);
    registry.beginFrame();
    registry.update(kDeltaTime, 0);

    assert.deepStrictEqual(log, ["late", "early"]);
  });

  test("should run the components and actors the update pass started with", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    const actor = createActor("first");
    const first = actor.addComponentAndGet(Logger, log);
    actor.addComponent(Logger, log);
    first.onUpdate = () => {
      first.needUpdate = false;
      actor.addComponent(Logger, log);
      createActor("spawned").addComponent(Logger, log);
    };
    registry.beginFrame();

    registry.update(kDeltaTime, 0);

    assert.deepStrictEqual(log, ["first", "first"]);
  });

  test("should update each actor once per frame even when actor ids repeat", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    Actor.Id.clear();
    const first = createActor("first");
    Actor.Id.clear();
    const second = createActor("second");

    second.addComponent(Logger, log);
    first.addComponent(Logger, log);
    second.addComponent(Recorder);
    registry.beginFrame();
    registry.update(kDeltaTime, 0);

    assert.deepStrictEqual(log.toSorted(), ["first", "second"]);
  });

  test("should report updating only while an actor holds an updating component", () => {
    const { registry, createActor } = createRegistry();
    const empty = registry.updating;
    const actor = createActor("actor");
    const recorder = actor.addComponentAndGet(Recorder);
    const started = registry.updating;

    recorder.needUpdate = false;
    const paused = registry.updating;
    recorder.needUpdate = true;
    actor.destroy();

    assert.deepStrictEqual(
      [empty, started, paused, registry.updating],
      [false, true, false, false]
    );
  });

  test("should stop updating an actor once it is destroyed", () => {
    const { registry, createActor } = createRegistry();
    const actor = createActor("actor");
    const recorder = actor.addComponentAndGet(Recorder);
    registry.beginFrame();

    actor.destroy();
    registry.beginFrame();
    registry.update(kDeltaTime, 0);

    assert.deepStrictEqual(recorder.calls, ["awake", "start"]);
  });

  test("should destroy a component at the end of the frame, without starting it", () => {
    const { registry, createActor } = createRegistry();
    const actor = createActor("owner");
    const recorder = actor.addComponentAndGet(Recorder);
    const destroy = mock.method(recorder, "destroy");

    registry.destroyLater(recorder);
    registry.destroyLater(recorder);
    registry.beginFrame();
    registry.endFrame();
    registry.endFrame();

    assert.strictEqual(recorder.pendingForDestruction, true);
    assert.deepStrictEqual(recorder.calls, ["awake"]);
    assert.strictEqual(destroy.mock.callCount(), 1);
    assert.deepStrictEqual(actor.components, []);
    assert.deepStrictEqual(actor.componentsRequiringUpdate, []);
  });

  test("should destroy each actor of a subtree marked for destruction exactly once", () => {
    const { registry, createActor } = createRegistry();
    const parent = createActor("parent");
    const child = createActor("child", parent);
    const grandChild = createActor("grandChild", child);
    const destroyCalls = [parent, child, grandChild].map(
      (actor) => mock.method(actor, "destroy")
    );

    registry.beginFrame();
    registry.tree.destroyActor(parent);
    registry.endFrame();

    assert.deepEqual(destroyCalls.map((call) => call.mock.callCount()), [1, 1, 1]);
    assert.strictEqual(registry.tree.getActor("parent"), null);
  });

  test("should destroy the roots of collected actors and skip the ones already gone", () => {
    const { registry, createActor } = createRegistry();
    const kept = createActor("kept");
    let parent: Actor | null = null;
    let gone: Actor | null = null;
    const collected = registry.collect(() => {
      parent = createActor("parent");
      createActor("child", parent);
      gone = createActor("gone");
    });
    const destroyGone = mock.method(gone!, "destroy");
    gone!.destroy();

    registry.destroyRoots(collected);

    assert.deepStrictEqual(registry.tree.children, [kept]);
    assert.strictEqual(destroyGone.mock.callCount(), 1);
  });
});
