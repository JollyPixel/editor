// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import { SelectionManager, PeerHoverRegistry } from "#src/index.ts";
import { PeerHoverSync } from "#src/network/index.ts";

function setup(
  options: { presenceKey?: string; throttleMs?: number; resyncIntervalMs?: number; } = {}
) {
  const room = new FakeRoom("three:peer-hover-test");
  const registry = new PeerHoverRegistry();
  const selection = new SelectionManager();
  const sync = new PeerHoverSync({
    room,
    registry,
    selection,
    throttleMs: options.throttleMs ?? 0,
    // Off by default - a test only opts in explicitly (see "resync" below),
    // so an unrelated test never has a live interval running under it.
    resyncIntervalMs: options.resyncIntervalMs ?? 0,
    presenceKey: options.presenceKey
  });

  return {
    room, registry, selection, sync
  };
}

describe("remote peers", () => {
  test("applies a peer already known at construction", () => {
    const room = new FakeRoom("three:peer-hover-test");
    room.addPeer("alice", { presence: { hover: "box-1" } });
    const registry = new PeerHoverRegistry();

    new PeerHoverSync({
      room,
      registry,
      selection: new SelectionManager(),
      throttleMs: 0,
      resyncIntervalMs: 0
    });

    assert.equal(registry.hoverOf("alice"), "box-1");
  });

  test("picks up peers landed by the join snapshot on \"sync\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });

    room.emitSync("alice");

    assert.equal(registry.hoverOf("alice"), "box-1");
  });

  test("picks up a peer on \"peer-joined\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });

    room.emitJoin("alice");

    assert.equal(registry.hoverOf("alice"), "box-1");
  });

  test("applies hover patches from \"peer-presence\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: null } });
    room.emitSync("alice");

    room.emitPresence("alice", { hover: "box-2" });

    assert.equal(registry.hoverOf("alice"), "box-2");
  });

  test("clears a peer's hover when it publishes null", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");

    room.emitPresence("alice", { hover: null });

    assert.equal(registry.hoverOf("alice"), null);
  });

  test("ignores a patch that carries no hover key", () => {
    const { room, registry } = setup();

    room.emitPresence("alice", { cursor: { x: 1 } });

    assert.equal(registry.hoverOf("alice"), null);
    assert.deepEqual(registry.hoveredObjectIds(), []);
  });

  test("ignores a malformed hover value, leaving prior state alone", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");

    room.emitPresence("alice", { hover: 42 });

    assert.equal(registry.hoverOf("alice"), "box-1");
  });

  test("removes a peer's hover on \"peer-left\"", () => {
    const { room, registry } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");

    room.emitLeft("alice");

    assert.equal(registry.hoverOf("alice"), null);
  });
});

describe("presence key", () => {
  test("publishes and reads hovers under a custom key", () => {
    const { room, registry, selection } = setup({ presenceKey: "point" });
    room.addPeer("alice", { presence: { point: "box-1" } });
    room.emitSync("alice");

    selection.register("box-2", new THREE.Object3D());
    selection.hover("box-2");

    assert.equal(registry.hoverOf("alice"), "box-1");
    assert.deepEqual(room.lastPatch, { point: "box-2" });
  });
});

describe("local reporting", () => {
  test("reports null on construction with no local hover", () => {
    const { room } = setup();

    assert.deepEqual(room.patches, [{ hover: null }]);
  });

  test("reports the hovered id on hoverChange", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());

    selection.hover("box-1");

    assert.deepEqual(room.lastPatch, { hover: "box-1" });
  });

  test("reports null again when the local hover clears", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());
    selection.hover("box-1");

    selection.hover(null);

    assert.deepEqual(room.lastPatch, { hover: null });
  });

  test("reports the hovered id even when it equals the local selection", () => {
    const { room, selection } = setup();
    selection.register("box-1", new THREE.Object3D());
    selection.select("box-1");
    selection.hover("box-1");

    assert.deepEqual(room.lastPatch, { hover: "box-1" });
  });
});

describe("throttling", () => {
  test("sends immediately once the window has already elapsed since the last report", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { room, selection } = setup({ throttleMs: 50 });
    selection.register("box-1", new THREE.Object3D());

    t.mock.timers.tick(50);
    selection.hover("box-1");

    assert.deepEqual(room.patches, [{ hover: null }, { hover: "box-1" }]);
  });

  test("schedules a trailing flush for a report suppressed by the window", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const { room, selection } = setup({ throttleMs: 50 });
    selection.register("box-1", new THREE.Object3D());

    selection.hover("box-1");
    assert.equal(room.patches.length, 1);

    t.mock.timers.tick(50);
    assert.deepEqual(room.lastPatch, { hover: "box-1" });
  });

  test("a later hover change before the flush replaces the pending value", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const { room, selection } = setup({ throttleMs: 50 });
    selection.register("box-1", new THREE.Object3D());
    selection.register("box-2", new THREE.Object3D());
    selection.register("box-3", new THREE.Object3D());

    selection.hover("box-1");
    selection.hover("box-2");
    selection.hover("box-3");

    t.mock.timers.tick(50);

    assert.deepEqual(room.patches, [
      { hover: null },
      { hover: "box-3" }
    ]);
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

  test("does not react to hover changes after destroy()", () => {
    const { room, selection, sync } = setup();
    selection.register("box-1", new THREE.Object3D());

    sync.destroy();
    selection.hover("box-1");

    assert.deepEqual(room.patches, [{ hover: null }]);
  });

  test("destroy() clears a pending trailing flush", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const { room, selection, sync } = setup({ throttleMs: 50 });
    selection.register("box-1", new THREE.Object3D());
    selection.register("box-2", new THREE.Object3D());

    selection.hover("box-1");
    selection.hover("box-2");
    sync.destroy();

    t.mock.timers.tick(50);

    assert.deepEqual(room.patches, [{ hover: null }]);
  });

  test("destroy() removes every peer this instance applied", () => {
    const { room, registry, sync } = setup();
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");
    assert.equal(registry.hoverOf("alice"), "box-1");

    sync.destroy();

    assert.equal(registry.hoverOf("alice"), null);
  });

  test("stops applying peer presence after destroy()", () => {
    const { room, registry, sync } = setup();
    sync.destroy();

    room.addPeer("bob", { presence: { hover: "box-1" } });
    room.emitSync("bob");

    assert.equal(registry.hoverOf("bob"), null);
  });
});

describe("resync", () => {
  test("periodically re-applies room.peers, catching a presence change no event ever announced", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");
    assert.equal(registry.hoverOf("alice"), "box-1");

    room.addPeer("alice", { presence: { hover: "box-2" } });
    assert.equal(registry.hoverOf("alice"), "box-1", "not caught yet - no event fired");

    t.mock.timers.tick(1000);

    assert.equal(registry.hoverOf("alice"), "box-2");
  });

  test("resyncIntervalMs: 0 disables the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry } = setup({ resyncIntervalMs: 0 });
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");

    room.addPeer("alice", { presence: { hover: "box-2" } });
    t.mock.timers.tick(10_000);

    assert.equal(registry.hoverOf("alice"), "box-1", "no resync ever runs");
  });

  test("destroy() stops the periodic resync", (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { room, registry, sync } = setup({ resyncIntervalMs: 1000 });
    room.addPeer("alice", { presence: { hover: "box-1" } });
    room.emitSync("alice");

    sync.destroy();
    room.addPeer("alice", { presence: { hover: "box-2" } });
    t.mock.timers.tick(1000);

    assert.equal(registry.hoverOf("alice"), null);
  });
});
