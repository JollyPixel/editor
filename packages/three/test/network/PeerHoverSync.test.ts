// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import { MeshHighlightState, PeerHoverRegistry } from "#src/index.ts";
import { PeerHoverSync } from "#src/network/index.ts";
import { joinPeer } from "./helpers.ts";

function setup(
  options: { presenceKey?: string; throttleMs?: number; } = {}
) {
  const room = new FakeRoom();
  const registry = new PeerHoverRegistry();
  const selection = new MeshHighlightState();
  const sync = new PeerHoverSync({
    room,
    registry,
    selection,
    throttleMs: options.throttleMs ?? 0,
    presenceKey: options.presenceKey
  });

  return {
    room, registry, selection, sync
  };
}

describe("remote peers", () => {
  test("applies a peer already known at construction", () => {
    const room = new FakeRoom();
    room.addPeer("alice", { presence: { hover: "box-1" } });
    const registry = new PeerHoverRegistry();

    new PeerHoverSync({
      room,
      registry,
      selection: new MeshHighlightState(),
      throttleMs: 0
    });

    assert.equal(registry.hoverOf("alice"), "box-1");
  });

  test("applies hover patches from \"peer-presence\"", () => {
    const { room, registry } = setup();
    joinPeer(room, "alice", { hover: null });

    room.emitPresence("alice", { hover: "box-2" });

    assert.equal(registry.hoverOf("alice"), "box-2");
  });

  test("clears a peer's hover when it publishes null", () => {
    const { room, registry } = setup();
    joinPeer(room, "alice", { hover: "box-1" });

    room.emitPresence("alice", { hover: null });

    assert.equal(registry.hoverOf("alice"), null);
  });

  test("removes a peer's hover on \"peer-left\"", () => {
    const { room, registry } = setup();
    joinPeer(room, "alice", { hover: "box-1" });

    room.emitLeft("alice");

    assert.equal(registry.hoverOf("alice"), null);
  });
});

describe("presence key", () => {
  test("publishes and reads hovers under a custom key", () => {
    const { room, registry, selection } = setup({ presenceKey: "point" });
    joinPeer(room, "alice", { point: "box-1" });

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
    joinPeer(room, "alice", { hover: "box-1" });
    assert.equal(registry.hoverOf("alice"), "box-1");

    sync.destroy();

    assert.equal(registry.hoverOf("alice"), null);
  });

  test("stops applying peer presence after destroy()", () => {
    const { room, registry, sync } = setup();
    sync.destroy();

    joinPeer(room, "bob", { hover: "box-1" });

    assert.equal(registry.hoverOf("bob"), null);
  });
});
