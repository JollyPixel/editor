// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import { SelectionManager, PeerSelectionRegistry } from "#src/index.ts";
import { PeerSelectionSync } from "#src/network/index.ts";

function setup(
  options: { presenceKey?: string; resyncIntervalMs?: number; } = {}
) {
  const room = new FakeRoom("three:peer-selection-test");
  const registry = new PeerSelectionRegistry();
  const selection = new SelectionManager();
  const sync = new PeerSelectionSync({
    room,
    registry,
    selection,
    resyncIntervalMs: options.resyncIntervalMs ?? 0,
    presenceKey: options.presenceKey
  });

  return {
    room, registry, selection, sync
  };
}

describe("remote peers", () => {
  test("applies a peer already known at construction", () => {
    const room = new FakeRoom("three:peer-selection-test");
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

    room.emitSync("alice");

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("picks up a peer on \"peer-joined\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });

    room.emitJoin("alice");

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("applies selection patches from \"peer-presence\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: null } });
    room.emitSync("alice");

    room.emitPresence("alice", { selection: "box-2" });

    assert.equal(registry.selectionOf("alice"), "box-2");
  });

  test("clears a peer's selection when it publishes null", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");

    room.emitPresence("alice", { selection: null });

    assert.equal(registry.selectionOf("alice"), null);
  });

  test("ignores a patch that carries no selection key", () => {
    const { room, registry } = setup();

    room.emitPresence("alice", { cursor: { x: 1 } });

    assert.equal(registry.selectionOf("alice"), null);
    assert.deepEqual(registry.selectedObjectIds(), []);
  });

  test("ignores a malformed selection value, leaving prior state alone", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");

    room.emitPresence("alice", { selection: 42 });

    assert.equal(registry.selectionOf("alice"), "box-1");
  });

  test("removes a peer's selection on \"peer-left\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");

    room.emitLeft("alice");

    assert.equal(registry.selectionOf("alice"), null);
  });
});

describe("presence key", () => {
  test("publishes and reads selections under a custom key", () => {
    const { room, registry, selection } = setup({ presenceKey: "pick" });
    room.addPeer("alice", { presence: { pick: "box-1" } });
    room.emitSync("alice");

    selection.register("box-2", new THREE.Object3D());
    selection.select("box-2");

    assert.equal(registry.selectionOf("alice"), "box-1");
    assert.deepEqual(room.lastPatch, { pick: "box-2" });
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

    assert.deepEqual(room.lastPatch, { selection: "box-1" });
  });

  test("reports null again when the local selection clears", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());
    selection.select("box-1");

    selection.select(null);

    assert.deepEqual(room.lastPatch, { selection: null });
  });
});

describe("lifecycle", () => {
  test("destroy() unsubscribes from every room event", () => {
    const { room, sync } = setup();
    assert.deepEqual(room.subscribedEvents(), [
      "peer-joined",
      "peer-left",
      "peer-presence",
      "sync"
    ]);

    sync.destroy();

    assert.deepEqual(room.subscribedEvents(), []);
  });

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
    room.emitSync("alice");
    assert.equal(registry.selectionOf("alice"), "box-1");

    sync.destroy();

    assert.equal(registry.selectionOf("alice"), null);
  });

  test("stops applying peer presence after destroy()", () => {
    const { room, registry, sync } = setup();
    sync.destroy();

    room.addPeer("bob", { presence: { selection: "box-1" } });
    room.emitSync("bob");

    assert.equal(registry.selectionOf("bob"), null);
  });
});

describe("resync", () => {
  test("periodically re-applies room.peers, catching a presence change no event ever announced", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");
    assert.equal(registry.selectionOf("alice"), "box-1");

    room.addPeer("alice", { presence: { selection: "box-2" } });
    assert.equal(registry.selectionOf("alice"), "box-1", "not caught yet - no event fired");

    t.mock.timers.tick(1000);

    assert.equal(registry.selectionOf("alice"), "box-2");
  });

  test("resyncIntervalMs: 0 disables the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 0 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");

    room.addPeer("alice", { presence: { selection: "box-2" } });
    t.mock.timers.tick(10_000);

    assert.equal(registry.selectionOf("alice"), "box-1", "no resync ever runs");
  });

  test("destroy() stops the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry, sync } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { selection: "box-1" } });
    room.emitSync("alice");

    sync.destroy();
    room.addPeer("alice", { presence: { selection: "box-2" } });
    t.mock.timers.tick(1000);
    assert.equal(registry.selectionOf("alice"), null);
  });
});
