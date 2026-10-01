// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  frustumsOf,
  joinPeer,
  pose,
  setup
} from "./helpers.ts";

describe("local reporting", () => {
  test("reports the source pose on update()", () => {
    const { room, sync } = setup();
    const source = new THREE.Object3D();
    source.position.set(1, 2, 3);
    sync.attach(source);

    sync.update();

    assert.deepEqual(room.patches, [
      {
        frustum: {
          position: { x: 1, y: 2, z: 3 },
          quaternion: { x: 0, y: 0, z: 0, w: 1 }
        }
      }
    ]);
  });

  test("skips sub-epsilon jitter", () => {
    const { room, sync } = setup();
    const source = new THREE.Object3D();
    sync.attach(source);
    sync.update();

    source.position.x = 1e-6;
    sync.update();

    assert.equal(room.patches.length, 1);
  });

  test("throttles moves to one report per window", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { room, sync } = setup({ throttleMs: 50 });
    const source = new THREE.Object3D();
    sync.attach(source);

    sync.update();
    source.position.x = 1;
    sync.update();
    assert.equal(room.patches.length, 1);

    t.mock.timers.tick(50);
    sync.update();
    assert.deepEqual(room.patches[1], { frustum: pose(1) });
  });
});

describe("lifecycle", () => {
  test("throws when a source is already attached", () => {
    const { sync } = setup();
    sync.attach(new THREE.Object3D());

    assert.throws(
      () => sync.attach(new THREE.Object3D()),
      /already attached/
    );
  });

  test("detach() stops reporting and allows a new source", () => {
    const { room, sync } = setup();
    sync.attach(new THREE.Object3D());

    sync.detach();
    sync.update();
    assert.equal(room.patches.length, 0);

    sync.attach(new THREE.Object3D());
    sync.update();
    assert.equal(room.patches.length, 1);
  });

  test("destroy() drops every peer and unsubscribes from the room", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    sync.destroy();
    assert.equal(frustumsOf(parent).length, 0);
    assert.deepEqual(room.subscribedEvents(), []);

    joinPeer(room, "bob", { frustum: pose(2) });
    assert.equal(frustumsOf(parent).length, 0);
  });
});
