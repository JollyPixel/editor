// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { RigidBody } from "#src/engine/RigidBody.ts";
import { RigidBodyDefinition } from "#src/engine/RigidBodyDefinition.ts";
import { ColliderOutline } from "#src/engine/ColliderOutline.ts";
import { createPhysicsHarness } from "../helpers/engineWorld.ts";

// CONSTANTS
const kAssets = new Systems.ComponentAssets({}, {}, {
  resolve: () => null
});
const kUnitBox = {
  shape: {
    type: "box",
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 }
  },
  offset: { x: 0, y: 0, z: 0 },
  friction: 0.5,
  restitution: 0,
  density: 1,
  sensor: false
};

function context(
  mode: Systems.SceneMode
): Systems.ComponentContext {
  return {
    mode,
    assets: kAssets
  };
}

describe("RigidBodyDefinition", () => {
  const definition = new RigidBodyDefinition();

  it("falls back to defaults for missing or invalid fields", () => {
    assert.deepEqual(definition.parse({ kind: "floating", gravityScale: "x" }), {
      kind: "dynamic",
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 1,
      ccd: false,
      lockRotations: false,
      colliders: [kUnitBox]
    });
  });

  it("keeps an empty collider list and reads each invalid entry leniently", () => {
    assert.deepEqual(definition.parse({ colliders: [] }).colliders, []);
    assert.deepEqual(
      definition.parse({ colliders: [42, { shape: { type: "cone" } }] }).colliders,
      [kUnitBox]
    );
  });

  it("outlines the colliders in edit mode without creating a body", () => {
    const { world, physics } = createPhysicsHarness();
    const actor = world.createActor("box");

    const component = definition.create(
      actor,
      definition.parse({ kind: "kinematic" }),
      context("edit")
    );

    assert.ok(component instanceof ColliderOutline);
    assert.equal(physics.bodies.length, 0);
  });

  it("redraws an outline on apply and asks to rebuild a RigidBody", () => {
    const { world } = createPhysicsHarness();
    const data = definition.parse({});
    const next = definition.parse({ colliders: [] });
    const outline = definition.create(
      world.createActor("edited"),
      data,
      context("edit")
    );
    const body = definition.create(
      world.createActor("played"),
      data,
      context("play")
    );

    assert.equal(definition.apply(outline, next), true);
    assert.deepEqual(outline.settings.colliders, []);
    assert.ok(body instanceof RigidBody);
    assert.equal(definition.apply(body, next), false);
    assert.equal(body.settings.colliders.length, 1);
  });

  it("round-trips every scene shape through a play-mode component", () => {
    const { world } = createPhysicsHarness();
    const actor = world.createActor("thing");
    const material = {
      friction: 0.5,
      restitution: 0.4,
      density: 1,
      sensor: false,
      offset: { x: 1, y: 0, z: 0 }
    };
    const colliders: Systems.JSONObject[] = [
      {
        ...material,
        shape: {
          type: "box",
          halfExtents: { x: 1, y: 2, z: 3 }
        }
      },
      {
        ...material,
        shape: {
          type: "sphere",
          radius: 2
        }
      },
      {
        ...material,
        shape: {
          type: "capsule",
          halfHeight: 1,
          radius: 0.25
        }
      }
    ];
    const data = definition.parse({
      kind: "fixed",
      colliders
    });

    const component = definition.create(actor, data, context("play"));

    assert.ok(component instanceof RigidBody);
    assert.equal(definition.owns(component), true);
    assert.deepEqual(definition.capture(component), {
      kind: "fixed",
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 1,
      ccd: false,
      lockRotations: false,
      colliders
    });
  });

  it("does not own a RigidBody with a trimesh collider made in code", () => {
    const { world } = createPhysicsHarness();
    const actor = world.createActor("terrain");
    const component = actor.addComponentAndGet(RigidBody, {
      kind: "fixed",
      colliders: [
        {
          shape: {
            type: "trimesh",
            vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
            indices: new Uint32Array([0, 1, 2])
          }
        }
      ]
    });

    assert.equal(definition.owns(component), false);
  });
});
