// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import { watchDisposal } from "../fixtures/disposal.ts";
import { PeerFrustum } from "#src/index.ts";
import { PeerFrustumSync } from "#src/network/index.ts";
import {
  frustumsOf,
  joinPeer,
  pose,
  setup
} from "./helpers.ts";

describe("remote peers", () => {
  test("creates a frustum for a peer already known at construction", () => {
    const room = new FakeRoom();
    const parent = new THREE.Object3D();
    room.addPeer("alice", { presence: { frustum: pose(3) } });

    new PeerFrustumSync({ room, parent });

    const [frustum] = frustumsOf(parent);
    assert.equal(frustumsOf(parent).length, 1);
    assert.equal(frustum.visible, true);
    assert.equal(frustum.position.x, 3);
  });

  test("picks up peers landed by the join snapshot on \"sync\"", () => {
    const { room, parent, sync } = setup();
    room.emitSync();
    sync.attach(new THREE.Object3D());
    assert.equal(frustumsOf(parent).length, 0);

    joinPeer(room, "alice", { frustum: pose(1) });

    assert.equal(frustumsOf(parent).length, 1);
  });

  test("applies pose patches from \"peer-presence\"", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(0) });
    sync.attach(new THREE.Object3D());

    room.emitPresence("alice", {
      frustum: {
        position: { x: 1, y: 2, z: 3 },
        quaternion: { x: 0, y: 1, z: 0, w: 0 }
      }
    });

    const [frustum] = frustumsOf(parent);
    assert.equal(frustumsOf(parent).length, 1);
    assert.deepEqual(frustum.position.toArray(), [1, 2, 3]);
    assert.deepEqual(frustum.quaternion.toArray(), [0, 1, 0, 0]);
  });

  test("keeps the pose when a patch carries no pose key", () => {
    const { room, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });

    room.emitPresence("alice", { cursor: { x: 1 } });

    assert.deepEqual(sync.poseOf("alice"), pose(1));
  });

  test("hides a tracked peer whose pose becomes invalid", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    room.emitPresence("alice", { frustum: null });

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.visible, false);
  });

  test("removes and disposes a peer on \"peer-left\"", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());
    const [frustum] = frustumsOf(parent);
    const disposals = watchDisposal(frustum.geometry, frustum.material);

    room.emitLeft("alice");

    assert.equal(frustumsOf(parent).length, 0);
    assert.equal(frustum.parent, null);
    assert.deepEqual(disposals, [1, 1]);
  });

  test("reads back the last pose applied to a peer", () => {
    const { room, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    room.emitPresence("alice", {
      frustum: {
        position: { x: 4, y: 5, z: 6 },
        quaternion: { x: 0, y: 1, z: 0, w: 0 }
      }
    });

    assert.deepEqual(sync.poseOf("alice"), {
      position: { x: 4, y: 5, z: 6 },
      quaternion: { x: 0, y: 1, z: 0, w: 0 }
    });
  });

  test("copies the pose it reads back", () => {
    const { room, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    const first = sync.poseOf("alice");
    (first!.position as { x: number; }).x = 99;

    assert.equal(sync.poseOf("alice")?.position.x, 1);
  });

  test("has no pose for an unknown peer", () => {
    const { sync } = setup();
    sync.attach(new THREE.Object3D());

    assert.equal(sync.poseOf("alice"), undefined);
  });

  test("drops the pose when it becomes invalid or the peer leaves", () => {
    const { room, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    room.addPeer("bob", { presence: { frustum: pose(2) } });
    room.emitSync();
    sync.attach(new THREE.Object3D());

    room.emitPresence("alice", { frustum: null });
    room.emitLeft("bob");

    assert.equal(sync.poseOf("alice"), undefined);
    assert.equal(sync.poseOf("bob"), undefined);
  });

  test("reads the display name from the peer identity", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) }, { username: "Alice" });

    sync.attach(new THREE.Object3D());

    assert.equal(frustumsOf(parent)[0].displayName, "Alice");
  });
});

describe("presence key", () => {
  test("publishes and reads poses under a custom key", () => {
    const { room, parent, sync } = setup({ presenceKey: "camera" });
    joinPeer(room, "alice", { camera: pose(4) });

    sync.attach(new THREE.Object3D());
    sync.update();

    assert.equal(frustumsOf(parent)[0].position.x, 4);
    assert.deepEqual(Object.keys(room.patches[0]), ["camera"]);
  });
});

describe("colors", () => {
  test("resolves a color once per peer, then only on refreshColors()", () => {
    const colors = ["#111111", "#222222"];
    let calls = 0;
    const { room, parent, sync } = setup({
      color: () => colors[Math.min(calls++, colors.length - 1)]
    });
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.color, "#111111");

    sync.update();
    assert.equal(frustum.color, "#111111");

    sync.refreshColors();
    assert.equal(frustum.color, "#222222");
  });

  test("passes the peer identity to color", () => {
    const seen: PeerMetadata[] = [];
    const { room, sync } = setup({
      color: (_clientId, identity) => {
        seen.push(identity);

        return "#333333";
      }
    });
    joinPeer(room, "alice", { frustum: pose(1) }, { username: "Alice" });

    sync.attach(new THREE.Object3D());

    assert.deepEqual(seen, [{ username: "Alice" }]);
  });

  test("falls back to the PeerFrustum default without a color option", () => {
    const { room, parent, sync } = setup();
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    const [frustum] = frustumsOf(parent);
    assert.equal(
      frustum.color,
      PeerFrustum.Defaults.color
    );
  });

  test("gives every peer frustum.color, and refreshColors() keeps it", () => {
    const { room, parent, sync } = setup({
      frustum: { color: "#abcdef" }
    });
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    room.addPeer("bob", { presence: { frustum: pose(2) } });
    room.emitSync();
    sync.attach(new THREE.Object3D());

    const frustums = frustumsOf(parent);
    assert.deepEqual(
      frustums.map((frustum) => frustum.color),
      ["#abcdef", "#abcdef"]
    );

    sync.refreshColors();
    assert.deepEqual(
      frustums.map((frustum) => frustum.color),
      ["#abcdef", "#abcdef"]
    );
  });

  test("lets the color callback override frustum.color", () => {
    const { room, parent, sync } = setup({
      frustum: { color: "#abcdef" },
      color: () => "#123456"
    });
    joinPeer(room, "alice", { frustum: pose(1) });
    sync.attach(new THREE.Object3D());

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.color, "#123456");
  });
});
