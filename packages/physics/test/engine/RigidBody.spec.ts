// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { RigidBody } from "#src/engine/RigidBody.ts";
import {
  PhysicsSystem,
  type ActorContact
} from "#src/engine/PhysicsSystem.ts";
import {
  createEngineWorld,
  createPhysicsHarness
} from "../helpers/engineWorld.ts";
import {
  FakePhysicsBackend,
  type FakeBody,
  type FakeCollider
} from "../helpers/fakePhysics.ts";

// CONSTANTS
const kDown = {
  origin: { x: 0, y: 10, z: 0 },
  direction: { x: 0, y: -1, z: 0 },
  maxDistance: 100
};

describe("PhysicsSystem", () => {
  it("is required before a physics component can be added", () => {
    const world = createEngineWorld();
    const actor = world.createActor("box");

    assert.throws(() => actor.addComponentAndGet(RigidBody), /No PhysicsSystem/);
  });

  it("creates its physics world from the backend with the given options", () => {
    const world = createEngineWorld();
    const backend = new FakePhysicsBackend();
    const gravity = { x: 0, y: -1.62, z: 0 };

    const system = PhysicsSystem.attach(world, backend, { gravity });

    assert.equal(system.physics, backend.worlds[0]);
    assert.deepEqual(system.physics.gravity, gravity);
    assert.equal(PhysicsSystem.require(world), system);
  });

  it("refuses a second system without creating its physics world", () => {
    const { world, backend } = createPhysicsHarness();

    assert.throws(() => PhysicsSystem.attach(world, backend), /already attached/);
    assert.equal(backend.worlds.length, 1);
  });

  it("steps the physics world once per fixed step with the fixed delta", () => {
    const { physics, tick } = createPhysicsHarness();

    tick({ steps: 3 });

    assert.deepEqual(
      physics.calls.map((call) => call.type === "step" && Math.round(call.seconds * 6000)),
      [100, 100, 100]
    );
  });

  it("names the owning actor of a body made through ownedBodies", () => {
    const { world, physics, system, tick } = createPhysicsHarness();
    const terrain = world.createActor("terrain");
    const contacts: ActorContact[] = [];
    const chunk = system
      .ownedBodies(terrain, (contact) => contacts.push(contact))
      .createBody({ kind: "fixed" });
    const ground = chunk.attach({ shape: { type: "sphere", radius: 1 } });
    const loose = physics.createBody({ kind: "dynamic" })
      .attach({ shape: { type: "sphere", radius: 1 } });

    physics.nextHit = {
      collider: ground,
      distance: 1,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 }
    };
    physics.pendingContacts.push({
      started: true,
      first: loose,
      second: ground
    });
    tick();

    assert.equal(system.castRay(kDown)?.actor, terrain);
    assert.deepEqual(contacts, [
      {
        started: true,
        collider: ground,
        other: loose,
        actor: null
      }
    ]);
  });

  it("stops stepping and disposes the physics world on dispose", () => {
    const { world, physics, system, tick } = createPhysicsHarness();

    system.dispose();
    tick();

    assert.equal(physics.calls.length, 0);
    assert.equal(physics.disposed, true);
    assert.throws(() => PhysicsSystem.require(world), /No PhysicsSystem/);
  });
});

describe("RigidBody", () => {
  it("creates its body at the actor world pose with its settings", () => {
    const { world, physics } = createPhysicsHarness();
    const parent = world.createActor("parent");
    parent.transform.setLocalPosition(new THREE.Vector3(10, 0, 0));
    const actor = world.createActor("box", { parent });
    actor.transform.setLocalPosition(new THREE.Vector3(0, 2, 0));

    actor.addComponentAndGet(RigidBody, {
      kind: "dynamic",
      linearDamping: 0.3
    });

    const [body] = physics.bodies;
    assert.deepEqual(body.position, { x: 10, y: 2, z: 0 });
    assert.equal(body.desc.linearDamping, 0.3);
    assert.equal(body.desc.gravityScale, 1);
  });

  it("renders a dynamic body between its last two step poses", () => {
    const { world, physics, tick } = createPhysicsHarness();
    const actor = world.createActor("box");
    const { body } = actor.addComponentAndGet(RigidBody);
    physics.onStep = () => {
      (body as FakeBody).position = { x: 0, y: -1, z: 0 };
    };

    tick({ steps: 1, alpha: 0.25 });

    assert.equal(actor.transform.getGlobalPosition().y, -0.25);
  });

  it("pushes a kinematic actor pose to its body before each step", () => {
    const { world, physics, tick } = createPhysicsHarness();
    const actor = world.createActor("platform");
    actor.addComponentAndGet(RigidBody, { kind: "kinematic" });

    actor.transform.setLocalPosition(new THREE.Vector3(4, 0, 0));
    tick();

    assert.deepEqual(
      physics.calls.map((call) => (call.type === "moveTo" ? call.position.x : call.type)),
      [4, "step"]
    );
  });

  it("teleports without interpolating from the previous pose", () => {
    const { world, tick } = createPhysicsHarness();
    const actor = world.createActor("box");
    const rigidBody = actor.addComponentAndGet(RigidBody);

    rigidBody.teleport({ x: 0, y: 8, z: 0 });
    tick({ steps: 0, alpha: 0.5 });

    assert.equal(actor.transform.getGlobalPosition().y, 8);
  });

  it("attaches one unit box by default, or the colliders it is given", () => {
    const { world } = createPhysicsHarness();

    const crate = world.createActor("crate").addComponentAndGet(RigidBody);
    const coin = world.createActor("coin").addComponentAndGet(RigidBody, {
      kind: "fixed",
      colliders: [
        { shape: { type: "sphere", radius: 0.3 }, sensor: true },
        { friction: 0.9 }
      ]
    });

    assert.deepEqual(
      crate.colliders.map((collider) => (collider as FakeCollider).desc),
      [
        {
          shape: { type: "box", halfExtents: { x: 0.5, y: 0.5, z: 0.5 } },
          offset: { x: 0, y: 0, z: 0 },
          friction: 0.5,
          restitution: 0,
          density: 1,
          sensor: false
        }
      ]
    );
    assert.deepEqual(
      coin.colliders.map(({ sensor, body }) => [sensor, body === coin.body]),
      [[true, true], [false, true]]
    );
    assert.equal((coin.colliders[1] as FakeCollider).desc.friction, 0.9);
  });

  it("scales collider shapes and offsets by the actor's world scale", () => {
    const { world } = createPhysicsHarness();
    const parent = world.createActor("parent");
    parent.transform.setLocalScale(new THREE.Vector3(2, 2, 2));
    const actor = world.createActor("plank", { parent });
    actor.transform.setLocalScale(new THREE.Vector3(2, 0.5, 1));

    const rigidBody = actor.addComponentAndGet(RigidBody, {
      colliders: [
        { offset: { x: 1, y: 1, z: 0 } },
        { shape: { type: "sphere", radius: 0.5 } },
        { shape: { type: "capsule", halfHeight: 1, radius: 0.5 } }
      ]
    });

    assert.deepEqual(
      rigidBody.colliders.map((collider) => {
        const { desc } = collider as FakeCollider;

        return [desc.shape, desc.offset];
      }),
      [
        [
          { type: "box", halfExtents: { x: 2, y: 0.5, z: 1 } },
          { x: 4, y: 1, z: 0 }
        ],
        [
          { type: "sphere", radius: 2 },
          { x: 0, y: 0, z: 0 }
        ],
        [
          { type: "capsule", halfHeight: 1, radius: 2 },
          { x: 0, y: 0, z: 0 }
        ]
      ]
    );
  });

  it("reports contacts on both bodies with their own collider and the other actor", () => {
    const { world, physics, tick } = createPhysicsHarness();
    const player = world.createActor("player").addComponentAndGet(RigidBody);
    const coin = world.createActor("coin").addComponentAndGet(RigidBody, {
      kind: "fixed",
      colliders: [{ sensor: true }]
    });
    const seen: [string, ActorContact][] = [];
    player.contacts.connect((contact) => seen.push(["player", contact]));
    coin.contacts.connect((contact) => seen.push(["coin", contact]));

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

  it("removes its body when destroyed", () => {
    const { world, physics } = createPhysicsHarness();
    const actor = world.createActor("box");
    const rigidBody = actor.addComponentAndGet(RigidBody);

    rigidBody.destroy();

    assert.equal(physics.liveBodies.length, 0);
  });
});
