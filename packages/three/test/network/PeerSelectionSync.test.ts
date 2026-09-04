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
import { SelectionManager, PeerSelectionRegistry } from "#src/index.ts";
import { PeerSelectionSync } from "#src/network/index.ts";

/**
 * Room test double that serializes presence patches like the wire - same
 * shape as `PeerFrustumSync.test.ts`'s own `FakeRoom`.
 */
class FakeRoom implements Room {
  readonly id = "three:peer-selection-test";
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

function setup(
  options: { presenceKey?: string; resyncIntervalMs?: number; } = {}
) {
  const room = new FakeRoom();
  const registry = new PeerSelectionRegistry();
  const selection = new SelectionManager();
  const sync = new PeerSelectionSync({
    room,
    registry,
    selection,
    // Off by default - a test only opts in explicitly (see "resync" below),
    // so an unrelated test never has a live interval running under it.
    resyncIntervalMs: options.resyncIntervalMs ?? 0,
    ...options.presenceKey === undefined ? {} : { presenceKey: options.presenceKey }
  });

  return {
    room, registry, selection, sync
  };
}

describe("remote peers", () => {
  test("applies a peer already known at construction", () => {
    const room = new FakeRoom();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    const registry = new PeerSelectionRegistry();

    new PeerSelectionSync({
      room,
      registry,
      selection: new SelectionManager(),
      resyncIntervalMs: 0
    });

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("picks up peers landed by the join snapshot on \"sync\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });

    room.emit("sync", { clientIds: ["alice"] });

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("picks up a peer on \"peer-joined\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });

    room.emit("peer-joined", { clientId: "alice" });

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("applies selection patches from \"peer-presence\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: null } });
    room.emit("sync", { clientIds: ["alice"] });

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { selection: "box-2" }
    });

    assert.equal(registry.selectionOf("alice"), "box-2");
  });

  test("clears a peer's selection when it publishes null", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { selection: null }
    });

    assert.equal(registry.selectionOf("alice"), null);
  });

  test("ignores a patch that carries no selection key", () => {
    const { room, registry } = setup();

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { cursor: { x: 1 } }
    });

    assert.equal(registry.selectionOf("alice"), null);
    assert.deepEqual(registry.selectedObjectIds(), []);
  });

  test("ignores a malformed selection value, leaving prior state alone", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    room.emit("peer-presence", {
      clientId: "alice",
      patch: { selection: 42 }
    });

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("removes a peer's selection on \"peer-left\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    room.emit("peer-left", { clientId: "alice" });

    assert.equal(registry.selectionOf("alice"), null);
  });
});

describe("presence key", () => {
  test("publishes and reads selections under a custom key", () => {
    const { room, registry, selection } = setup({ presenceKey: "pick" });
    room.addPeer("alice", { presence: { pick: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    selection.register("box-2", new THREE.Object3D());
    selection.select("box-2");

    assert.equal(registry.selectionOf("alice"), "box-1");
    assert.deepEqual(room.patches.at(-1), { pick: "box-2" });
  });
});

describe("local reporting", () => {
  test("reports null on construction with no local selection", () => {
    const { room } = setup();

    assert.deepEqual(room.patches, [{ selection: null }]);
  });

  test("reports the selected id on selectionChange", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());

    selection.select("box-1");

    assert.deepEqual(room.patches.at(-1), { selection: "box-1" });
  });

  test("reports null again when the local selection clears", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());
    selection.select("box-1");

    selection.select(null);

    assert.deepEqual(room.patches.at(-1), { selection: null });
  });
});

describe("lifecycle", () => {
  test("does not react to selection changes after destroy()", () => {
    const { room, selection, sync } = setup();
    selection.register("box-1", new THREE.Object3D());

    sync.destroy();
    selection.select("box-1");

    assert.deepEqual(room.patches, [{ selection: null }]);
  });

  test("destroy() removes every peer this instance applied", () => {
    const { room, registry, sync } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });
    assert.equal(registry.selectionOf("alice"), "box-1");

    sync.destroy();

    assert.equal(registry.selectionOf("alice"), null);
  });

  test("stops applying peer presence after destroy()", () => {
    const { room, registry, sync } = setup();
    sync.destroy();

    room.addPeer("bob", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["bob"] });

    assert.equal(registry.selectionOf("bob"), null);
  });
});

describe("resync", () => {
  test("periodically re-applies room.peers, catching a presence change no event ever announced", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });
    assert.equal(registry.selectionOf("alice"), "box-1");

    // Simulates a dropped "peer-presence" message: the room's own state
    // moved on, but no event ever told this client - only the periodic
    // resync (not any event) can catch this.
    room.addPeer("alice", { presence: { selection: "box-2" } });
    assert.equal(registry.selectionOf("alice"), "box-1", "not caught yet - no event fired");

    t.mock.timers.tick(1000);

    assert.equal(registry.selectionOf("alice"), "box-2");
  });

  test("resyncIntervalMs: 0 disables the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 0 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    room.addPeer("alice", { presence: { selection: "box-2" } });
    t.mock.timers.tick(10_000);

    assert.equal(registry.selectionOf("alice"), "box-1", "no resync ever runs");
  });

  test("destroy() stops the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry, sync } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emit("sync", { clientIds: ["alice"] });

    sync.destroy();
    room.addPeer("alice", { presence: { selection: "box-2" } });
    t.mock.timers.tick(1000);

    // destroy() already removed "alice" entirely - a stray resync tick
    // must not resurrect it.
    assert.equal(registry.selectionOf("alice"), null);
  });
});
