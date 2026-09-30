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

// CONSTANTS
const kFadeDistances = {
  hideWithin: 1,
  fadeWithin: 3
};

describe("proximity fade", () => {
  test("leaves a distant peer opaque", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(10) });
    sync.attach(new THREE.Object3D());

    sync.update();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 1);
    assert.equal(frustum.visible, true);
  });

  test("hides a peer closer than hideWithin", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(0.5) });
    sync.attach(new THREE.Object3D());

    sync.update();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 0);
    assert.equal(frustum.visible, false);
  });

  test("ramps the opacity between the two distances", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(2) });
    sync.attach(new THREE.Object3D());

    sync.update();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 0.5);
    assert.equal(frustum.material.transparent, true);
    assert.equal(frustum.visible, true);
  });

  test("fades the label with the frustum", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(2) }, { username: "Alice" });
    sync.attach(new THREE.Object3D());

    sync.update();

    assert.equal(frustumsOf(parent)[0].label?.opacity, 0.5);
  });

  test("follows the source as it moves away", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    const source = new THREE.Object3D();
    joinPeer(room, "alice", { frustum: pose(0.5) });
    sync.attach(source);
    sync.update();

    source.position.x = -10;
    sync.update();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 1);
    assert.equal(frustum.visible, true);
  });

  test("fades a pose patch landing on top of the source", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(10) });
    sync.attach(new THREE.Object3D());

    room.emitPresence("alice", { frustum: pose(0.5) });

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.visible, false);
  });

  test("restores full opacity on detach()", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(0.5) });
    sync.attach(new THREE.Object3D());
    sync.update();

    sync.detach();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 1);
    assert.equal(frustum.visible, true);
  });

  test("keeps a poseless peer hidden through detach()", () => {
    const { room, parent, sync } = setup(kFadeDistances);
    joinPeer(room, "alice", { frustum: pose(2) });
    sync.attach(new THREE.Object3D());
    room.emitPresence("alice", { frustum: null });

    sync.detach();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.visible, false);
  });

  test("never fades without the distances", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(0.1) });
    sync.attach(new THREE.Object3D());

    sync.update();

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.opacity, 1);
    assert.equal(frustum.visible, true);
  });
});
