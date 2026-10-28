// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import {
  Behavior,
  SceneProperty,
  ScriptDefinition
} from "../../../src/index.ts";
import type { SceneMode } from "../../../src/systems/scene/file/definitions/ComponentDefinition.ts";
import type { JSONObject } from "../../../src/systems/scene/file/SceneFile.ts";
import { createSceneSetup } from "../../helpers/scene/sceneSetup.ts";
import { createSceneAssets } from "../../helpers/scene/sceneAssets.ts";
import {
  createComponentContext,
  createWarningLogger
} from "../../helpers/scene/sceneFile.ts";

class Mover extends Behavior {
  speed = 5;
  label = "idle";
  offset = new THREE.Vector3();
  tint = new THREE.Color();
  speedSeenInAwake = 0;

  awake() {
    this.speedSeenInAwake = this.speed;
  }
}
SceneProperty({ type: "number" })(Mover.prototype, "speed");
SceneProperty({ type: "string" })(Mover.prototype, "label");
SceneProperty({ type: "Vector3" })(Mover.prototype, "offset");
SceneProperty({ type: "Color" })(Mover.prototype, "tint");

class Follower extends Behavior {
  target: Actor | null = null;
}
SceneProperty({ type: "Actor" })(Follower.prototype, "target");

function createScript(
  mode: SceneMode,
  data: JSONObject
) {
  const { logger, warnings } = createWarningLogger();
  const { world } = createSceneSetup(createSceneAssets(), logger);
  const actor = new Actor(world as any, { name: "player" });
  const definition = new ScriptDefinition({ Mover });
  const component = definition.create(
    actor,
    definition.parse(data),
    createComponentContext(mode)
  );
  actor.awake();

  return { actor, component, warnings };
}

describe("Components.ScriptDefinition", () => {
  test("builds the registered behavior with its declared properties converted", () => {
    const { actor, component } = createScript("play", {
      behavior: "Mover",
      properties: {
        speed: 3,
        label: 4,
        offset: [0, 1, 0],
        tint: "#ff0000",
        extra: [1, 2]
      }
    });

    const mover = component as Mover & { extra?: unknown; };
    assert.ok(mover instanceof Mover);
    assert.deepEqual([...actor.getComponents(Mover)], [mover]);
    assert.strictEqual(mover.speed, 3);
    assert.strictEqual(mover.speedSeenInAwake, 3);
    assert.strictEqual(mover.label, "idle");
    assert.ok(mover.offset instanceof THREE.Vector3);
    assert.deepEqual(mover.offset.toArray(), [0, 1, 0]);
    assert.strictEqual(mover.tint.getHexString(), "ff0000");
    assert.strictEqual(mover.extra, undefined);
  });

  test("builds nothing in edit mode", () => {
    const { actor, component, warnings } = createScript("edit", {
      behavior: "Mover",
      properties: { speed: 3 }
    });

    assert.strictEqual(component, null);
    assert.deepEqual([...actor.components], []);
    assert.strictEqual(warnings().length, 0);
  });

  test("builds nothing, with a warning, when the behavior is not registered", () => {
    const { actor, component, warnings } = createScript("play", {
      behavior: "Jumper"
    });

    assert.strictEqual(component, null);
    assert.deepEqual([...actor.components], []);
    assert.strictEqual(warnings().length, 1);
  });

  test("captures the declared properties a registered behavior holds now", () => {
    const { component } = createScript("play", {
      behavior: "Mover",
      properties: { speed: 3 }
    });
    const mover = component as Mover;
    mover.speed = 8;
    mover.offset.set(1, 2, 3);
    const definition = new ScriptDefinition({ Mover });

    assert.deepEqual(definition.capture(mover), {
      behavior: "Mover",
      properties: {
        speed: 8,
        label: "idle",
        offset: [1, 2, 3],
        tint: "#ffffff"
      }
    });
  });

  test("owns registered behaviors only, by their exact class", () => {
    class FastMover extends Mover {}
    const { actor, component } = createScript("play", {
      behavior: "Mover"
    });
    const definition = new ScriptDefinition({ Mover });

    assert.strictEqual(definition.owns(component!), true);
    assert.strictEqual(new ScriptDefinition({}).owns(component!), false);
    assert.strictEqual(definition.owns(actor.addComponentAndGet(Follower)), false);
    assert.strictEqual(definition.owns(actor.addComponentAndGet(FastMover)), false);
  });

  test("resolves an Actor property to the actor holding that persistent id", () => {
    const { logger, warnings } = createWarningLogger();
    const { world } = createSceneSetup(createSceneAssets(), logger);
    const door = new Actor(world as any, { name: "door", persistentId: "door-1" });
    const guard = new Actor(world as any, { name: "guard" });
    const definition = new ScriptDefinition({ Follower });
    const context = createComponentContext("play");

    const follower = definition.create(guard, definition.parse({
      behavior: "Follower",
      properties: { target: "door-1" }
    }), context) as Follower;
    const lost = definition.create(guard, definition.parse({
      behavior: "Follower",
      properties: { target: "gone" }
    }), context) as Follower;
    guard.awake();

    assert.strictEqual(follower.target, door);
    assert.strictEqual(lost.target, null);
    assert.strictEqual(warnings().length, 1);
    assert.deepEqual(definition.capture(follower), {
      behavior: "Follower",
      properties: { target: "door-1" }
    });
  });
});
