// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FakeRoom } from "../fixtures/room.ts";
import type { MeshHighlight, PeerHighlights } from "#src/index.ts";
import { createStubColorAllocator } from "../mesh-highlight/peer/helpers.ts";
import {
  joinPeer,
  setupHighlightSync
} from "./helpers.ts";

// CONSTANTS
const kRoles: RoleCase[] = [
  {
    role: "selection",
    key: "selection",
    remote: (peers, peerId) => peers.selectedObject(peerId),
    local: (highlight, objectId) => highlight.select(objectId)
  },
  {
    role: "hover",
    key: "hover",
    remote: (peers, peerId) => peers.hoveredObject(peerId),
    local: (highlight, objectId) => highlight.hover(objectId)
  }
];

interface RoleCase {
  role: "selection" | "hover";
  key: string;
  remote: (peers: PeerHighlights, peerId: string) => string | null;
  local: (highlight: MeshHighlight, objectId: string | null) => void;
}

for (const { role, key, remote, local } of kRoles) {
  describe(`${role} presence`, () => {
    test("applies a peer already known at construction", () => {
      const room = new FakeRoom();
      room.addPeer("alice", { presence: { [key]: "box-1" } });

      const { peers } = setupHighlightSync({ room });

      assert.equal(remote(peers, "alice"), "box-1");
    });

    test("applies patches, a null clear, and a departure", () => {
      const { room, peers } = setupHighlightSync();
      joinPeer(room, "alice", { [key]: null });

      room.emitPresence("alice", { [key]: "box-2" });
      assert.equal(remote(peers, "alice"), "box-2");

      room.emitPresence("alice", { [key]: null });
      assert.equal(remote(peers, "alice"), null);

      room.emitPresence("alice", { [key]: "box-1" });
      room.emitLeft("alice");
      assert.equal(remote(peers, "alice"), null);
    });

    test("publishes the local id and its clear", () => {
      const { room, highlight } = setupHighlightSync();

      local(highlight, "box-1");
      assert.deepEqual(room.lastPatch, { [key]: "box-1" });

      local(highlight, null);
      assert.deepEqual(room.lastPatch, { [key]: null });
    });

    test("reads and writes under a custom key", () => {
      const customKey = `${key}-custom`;
      const { room, highlight, peers } = setupHighlightSync({ [`${role}Key`]: customKey });
      joinPeer(room, "alice", { [customKey]: "box-1" });

      local(highlight, "box-2");

      assert.equal(remote(peers, "alice"), "box-1");
      assert.deepEqual(room.lastPatch, { [customKey]: "box-2" });
    });

    test("stops reacting to both sides after destroy()", () => {
      const { room, highlight, peers, sync } = setupHighlightSync();
      joinPeer(room, "alice", { [key]: "box-1" });
      const published = room.patches.length;

      sync.destroy();
      local(highlight, "box-2");
      joinPeer(room, "bob", { [key]: "box-1" });

      assert.equal(remote(peers, "alice"), null);
      assert.equal(remote(peers, "bob"), null);
      assert.equal(room.patches.length, published);
    });
  });
}

describe("local reporting", () => {
  test("reports both roles as null on construction", () => {
    const { room } = setupHighlightSync();

    assert.deepEqual(room.patches, [{ selection: null }, { hover: null }]);
  });

  test("reports the hovered id even when it equals the local selection", () => {
    const { room, highlight } = setupHighlightSync();
    highlight.select("box-1");

    highlight.hover("box-1");

    assert.deepEqual(room.lastPatch, { hover: "box-1" });
  });
});

describe("peer colors", () => {
  test("keep the color of a peer whose hover drops while it still selects", () => {
    const colorAllocator = createStubColorAllocator();
    const { room } = setupHighlightSync({ colorAllocator });
    joinPeer(room, "alice", { selection: "box-1", hover: "box-2" });

    room.emitPresence("alice", { hover: 42 });

    assert.deepEqual(colorAllocator.released, []);
  });

  test("release a departing peer's color once", () => {
    const colorAllocator = createStubColorAllocator();
    const { room } = setupHighlightSync({ colorAllocator });
    joinPeer(room, "alice", { selection: "box-1", hover: "box-2" });

    room.emitLeft("alice");

    assert.deepEqual(colorAllocator.released, ["alice"]);
  });
});

describe("hover throttling", () => {
  test("sends immediately once the window has elapsed since the last report", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const { room, highlight } = setupHighlightSync({ hoverThrottleMs: 50 });

    t.mock.timers.tick(50);
    highlight.hover("box-1");

    assert.deepEqual(room.lastPatch, { hover: "box-1" });
  });

  test("a later hover before the flush replaces the pending value", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const { room, highlight } = setupHighlightSync({ hoverThrottleMs: 50 });

    highlight.hover("box-1");
    highlight.hover("box-2");
    highlight.hover("box-3");
    t.mock.timers.tick(50);

    assert.deepEqual(room.patches, [
      { selection: null },
      { hover: null },
      { hover: "box-3" }
    ]);
  });

  test("destroy() drops a pending trailing flush", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    const { room, highlight, sync } = setupHighlightSync({ hoverThrottleMs: 50 });

    highlight.hover("box-1");
    highlight.hover("box-2");
    sync.destroy();
    t.mock.timers.tick(50);

    assert.deepEqual(room.patches, [{ selection: null }, { hover: null }]);
  });
});
