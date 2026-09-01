// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type {
  Peer,
  PeerMetadata,
  Room,
  RoomEventMap
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PeerFrustum } from "#src/index.ts";
import { PeerFrustumSync } from "#src/network/index.ts";

/**
 * Room test double that serializes presence patches like the wire.
 */
class FakeRoom implements Room {
  readonly id = "three:peer-frustum-test";
  readonly clientId = "local-uuid-nobody-sees";
  readonly peers = new Map<string, Peer>();
  readonly patches: PeerMetadata[] = [];

  #listeners = new Map<string, Set<(...args: any[]) => void>>();

  join(): void {
    // No transport to join.
  }

  send(): void {
    // No transport to send through.
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.patches.push(JSON.parse(JSON.stringify(patch)));
  }

  leave(): void {
    this.peers.clear();
  }

  on<K extends keyof RoomEventMap>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    const set = this.#listeners.get(type) ?? new Set();
    set.add(listener as (...args: any[]) => void);
    this.#listeners.set(type, set);
  }

  off<K extends keyof RoomEventMap>(
    type: K,
    listener: RoomEventMap[K]
  ): void {
    this.#listeners.get(type)?.delete(listener as (...args: any[]) => void);
  }

  emit(
    type: keyof RoomEventMap,
    payload?: unknown
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  addPeer(
    clientId: string,
    peer: Partial<Omit<Peer, "clientId">> = {}
  ): void {
    this.peers.set(clientId, {
      clientId,
      identity: peer.identity ?? {},
      presence: peer.presence ?? {}
    });
  }
}

function pose(
  x: number,
  y = 0,
  z = 0
) {
  return {
    position: { x, y, z },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  };
}

function setup(
  options: { throttleMs?: number; presenceKey?: string; } = {}
) {
  const room = new FakeRoom();
  const parent = new THREE.Object3D();
  const sync = new PeerFrustumSync({
    room,
    parent,
    throttleMs: options.throttleMs ?? 0,
    ...options.presenceKey === undefined ?
      {} :
      { presenceKey: options.presenceKey }
  });

  return { room, parent, sync };
}

function frustumsOf(
  parent: THREE.Object3D
): PeerFrustum[] {
  return parent.children.filter(
    (child): child is PeerFrustum => child instanceof PeerFrustum
  );
}

describe("remote peers", () => {
  test("creates a frustum for a peer already known at attach()", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(3) } });

    sync.attach(new THREE.Object3D());

    const [frustum] = frustumsOf(parent);
    assert.equal(frustumsOf(parent).length, 1);
    assert.equal(frustum.visible, true);
    assert.equal(frustum.position.x, 3);
  });

  test("picks up peers landed by the join snapshot on \"sync\"", () => {
    const { room, parent, sync } = setup();
    sync.attach(new THREE.Object3D());
    assert.equal(frustumsOf(parent).length, 0);

    room.addPeer("alice", { presence: { frustum: pose(1) } });
    room.emit("sync", { clientIds: ["alice"] });

    assert.equal(frustumsOf(parent).length, 1);
  });

  test("does not duplicate a peer seen twice", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(1) } });

    sync.attach(new THREE.Object3D());
    room.emit("sync", { clientIds: ["alice"] });
    room.emit("peer-joined", { clientId: "alice" });

    assert.equal(frustumsOf(parent).length, 1);
  });

  test("applies pose patches from \"peer-presence\"", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(0) } });
    sync.attach(new THREE.Object3D());

    room.emit("peer-presence", {
      clientId: "alice",
      patch: {
        frustum: {
          position: { x: 1, y: 2, z: 3 },
          quaternion: { x: 0, y: 1, z: 0, w: 0 }
        }
      }
    });

    const [frustum] = frustumsOf(parent);
    assert.deepEqual(frustum.position.toArray(), [1, 2, 3]);
    assert.deepEqual(frustum.quaternion.toArray(), [0, 1, 0, 0]);
  });

  test("ignores a patch that carries no pose key", () => {
    const { room, parent, sync } = setup();
    sync.attach(new THREE.Object3D());

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { cursor: { x: 1 } }
    });

    assert.equal(frustumsOf(parent).length, 0);
  });

  test("hides a tracked peer whose pose becomes invalid", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    sync.attach(new THREE.Object3D());

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { frustum: null }
    });

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.visible, false);
  });

  test("removes and disposes a peer on \"peer-left\"", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    sync.attach(new THREE.Object3D());
    const [frustum] = frustumsOf(parent);

    room.emit("peer-left", { clientId: "alice" });

    assert.equal(frustumsOf(parent).length, 0);
    assert.equal(frustum.parent, null);
  });

  test("reads the display name from the peer identity", () => {
    const { room, parent, sync } = setup();
    room.addPeer("alice", {
      identity: { username: "Alice" },
      presence: { frustum: pose(1) }
    });

    sync.attach(new THREE.Object3D());

    assert.equal(frustumsOf(parent)[0].displayName, "Alice");
  });
});

describe("presence key", () => {
  test("publishes and reads poses under a custom key", () => {
    const { room, parent, sync } = setup({ presenceKey: "camera" });
    room.addPeer("alice", { presence: { camera: pose(4) } });

    sync.attach(new THREE.Object3D());
    sync.update();

    assert.equal(frustumsOf(parent)[0].position.x, 4);
    assert.deepEqual(Object.keys(room.patches[0]), ["camera"]);
  });
});

describe("colors", () => {
  test("resolves a color once per peer, then only on refreshColors()", () => {
    const room = new FakeRoom();
    const parent = new THREE.Object3D();
    const colors = ["#111111", "#222222"];
    let calls = 0;
    const sync = new PeerFrustumSync({
      room,
      parent,
      throttleMs: 0,
      color: () => colors[Math.min(calls++, colors.length - 1)]
    });
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    sync.attach(new THREE.Object3D());

    const [frustum] = frustumsOf(parent);
    assert.equal(frustum.color, "#111111");

    sync.update();
    assert.equal(frustum.color, "#111111");

    sync.refreshColors();
    assert.equal(frustum.color, "#222222");
  });

  test("passes the peer identity to color", () => {
    const room = new FakeRoom();
    const parent = new THREE.Object3D();
    const seen: PeerMetadata[] = [];
    const sync = new PeerFrustumSync({
      room,
      parent,
      color: (_clientId, identity) => {
        seen.push(identity);

        return "#333333";
      }
    });
    room.addPeer("alice", {
      identity: { username: "Alice" },
      presence: { frustum: pose(1) }
    });

    sync.attach(new THREE.Object3D());

    assert.deepEqual(seen, [{ username: "Alice" }]);
  });
});

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

  test("does nothing without an attached source", () => {
    const { room, sync } = setup();

    sync.update();

    assert.equal(room.patches.length, 0);
  });

  test("skips a report when the pose did not move", () => {
    const { room, sync } = setup();
    sync.attach(new THREE.Object3D());

    sync.update();
    sync.update();

    assert.equal(room.patches.length, 1);
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

  test("republishes after \"sync\" even when the source did not move", () => {
    const { room, sync } = setup();
    sync.attach(new THREE.Object3D());
    sync.update();

    room.emit("sync", { clientIds: [] });
    sync.update();

    assert.equal(room.patches.length, 2);
  });

  test("republishes after \"peer-joined\" even when the source did not move", () => {
    const { room, sync } = setup();
    sync.attach(new THREE.Object3D());
    sync.update();

    room.emit("peer-joined", { clientId: "alice" });
    sync.update();

    assert.equal(room.patches.length, 2);
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

  test("reports immediately after a republish, ignoring the window", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { room, sync } = setup({ throttleMs: 50 });
    const source = new THREE.Object3D();
    sync.attach(source);
    sync.update();

    source.position.x = 1;
    room.emit("peer-joined", { clientId: "alice" });
    sync.update();

    assert.equal(room.patches.length, 2);
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
    room.addPeer("alice", { presence: { frustum: pose(1) } });
    sync.attach(new THREE.Object3D());

    sync.destroy();
    assert.equal(frustumsOf(parent).length, 0);

    room.addPeer("bob", { presence: { frustum: pose(2) } });
    room.emit("sync", { clientIds: ["bob"] });
    assert.equal(frustumsOf(parent).length, 0);
  });
});
