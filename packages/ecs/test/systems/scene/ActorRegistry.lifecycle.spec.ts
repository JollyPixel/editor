// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  type Actor,
  ActorComponent
} from "../../../src/actor/index.ts";
import { createRegistry } from "../../helpers/scene/actorRegistry.ts";

// CONSTANTS
const kDeltaTime = 16.67;

class Lifecycle extends ActorComponent {
  #log: string[];
  #label: string;
  onAwake: () => void = () => undefined;
  onStart: () => void = () => undefined;
  onFixedUpdate: () => void = () => undefined;

  constructor(
    actor: Actor,
    options: { log: string[]; label?: string; }
  ) {
    super({ actor, typeName: "Lifecycle" });
    this.#log = options.log;
    this.#label = options.label ?? actor.name;
  }

  awake() {
    this.#log.push(`${this.#label}.awake`);
    this.onAwake();
  }

  start() {
    this.#log.push(`${this.#label}.start`);
    this.onStart();
  }

  fixedUpdate() {
    this.#log.push(`${this.#label}.fixedUpdate`);
    this.onFixedUpdate();
  }

  update() {
    this.#log.push(`${this.#label}.update`);
  }
}

describe("Systems.Scene.ActorRegistry lifecycle order", () => {
  test("should awake an actor spawned by a component's start before starting its components", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    const spawner = createActor("spawner").addComponentAndGet(Lifecycle, { log });
    spawner.onStart = () => {
      createActor("spawned").addComponent(Lifecycle, { log });
    };

    registry.beginFrame();
    registry.beginFrame();

    assert.deepStrictEqual(log, [
      "spawner.awake",
      "spawner.start",
      "spawned.awake",
      "spawned.start"
    ]);
  });

  test("should awake a child spawned during awake under an awoken actor before starting it", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    const first = createActor("first");
    const spawner = createActor("spawner").addComponentAndGet(Lifecycle, { log });
    spawner.onAwake = () => {
      createActor("child", first).addComponent(Lifecycle, { log });
    };

    registry.beginFrame();

    assert.deepStrictEqual(log, [
      "spawner.awake",
      "child.awake",
      "spawner.start",
      "child.start"
    ]);
  });

  test("should not update a component added mid-frame before it starts", () => {
    const { registry, createActor } = createRegistry();
    const log: string[] = [];
    const actor = createActor("host");
    const host = actor.addComponentAndGet(Lifecycle, { log });
    host.onFixedUpdate = () => {
      host.onFixedUpdate = () => undefined;
      actor.addComponent(Lifecycle, { log, label: "late" });
    };
    registry.beginFrame();
    log.length = 0;

    registry.fixedUpdate(kDeltaTime, 0);
    registry.update(kDeltaTime, 0);
    registry.beginFrame();
    registry.update(kDeltaTime, 0);

    assert.deepStrictEqual(log, [
      "host.fixedUpdate",
      "late.awake",
      "host.update",
      "late.start",
      "host.update",
      "late.update"
    ]);
  });
});
