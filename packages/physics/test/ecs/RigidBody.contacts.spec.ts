// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RigidBody } from "#src/ecs/RigidBody.ts";
import type { ActorContact } from "#src/ecs/PhysicsSystem.ts";
import { createPhysicsHarness } from "../helpers/engineWorld.ts";

describe("RigidBody contacts", () => {
  it("reports contacts on both bodies with their own collider and the other actor", () => {
    const { world, physics, tick } = createPhysicsHarness();
    const player = world.createActor("player").addComponentAndGet(RigidBody);
    const coin = world.createActor("coin").addComponentAndGet(RigidBody, {
      kind: "fixed",
      colliders: [{ sensor: true }]
    });
    const seen: [string, ActorContact][] = [];
    player.contactStarted.connect((contact) => seen.push(["player", contact]));
    coin.contactStarted.connect((contact) => seen.push(["coin", contact]));

    physics.pendingContacts.push({
      started: true,
      first: player.colliders[0],
      second: coin.colliders[0]
    });
    tick();

    assert.deepEqual(seen, [
      [
        "player",
        {
          started: true,
          collider: player.colliders[0],
          other: coin.colliders[0],
          actor: coin.actor
        }
      ],
      [
        "coin",
        {
          started: true,
          collider: coin.colliders[0],
          other: player.colliders[0],
          actor: player.actor
        }
      ]
    ]);
  });

  it("reports an ended contact on contactEnded only", () => {
    const { world, physics, tick } = createPhysicsHarness();
    const player = world.createActor("player").addComponentAndGet(RigidBody);
    const coin = world.createActor("coin").addComponentAndGet(RigidBody, {
      kind: "fixed",
      colliders: [{ sensor: true }]
    });
    const started: ActorContact[] = [];
    const ended: ActorContact[] = [];
    player.contactStarted.connect((contact) => started.push(contact));
    player.contactEnded.connect((contact) => ended.push(contact));

    physics.pendingContacts.push({
      started: false,
      first: player.colliders[0],
      second: coin.colliders[0]
    });
    tick();

    assert.deepEqual(started, []);
    assert.deepEqual(ended.map(({ actor }) => actor), [coin.actor]);
  });
});
