// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerHighlights,
  type HighlightIndicatorRole,
  type PeerHighlightChangeEventDetail
} from "#src/index.ts";
import { createStubColorAllocator } from "./helpers.ts";

// CONSTANTS
const kRoles: RoleCase[] = [
  {
    role: "selection",
    mark: (peers, peerId, objectId) => peers.select(peerId, objectId),
    markedObject: (peers, peerId) => peers.selectedObject(peerId),
    markers: (peers, objectId) => peers.selectors(objectId),
    objectIds: (peers) => peers.selectedObjectIds()
  },
  {
    role: "hover",
    mark: (peers, peerId, objectId) => peers.hover(peerId, objectId),
    markedObject: (peers, peerId) => peers.hoveredObject(peerId),
    markers: (peers, objectId) => peers.hoverers(objectId),
    objectIds: (peers) => peers.hoveredObjectIds()
  }
];

interface RoleCase {
  role: HighlightIndicatorRole;
  mark: (peers: PeerHighlights, peerId: string, objectId: string | null) => void;
  markedObject: (peers: PeerHighlights, peerId: string) => string | null;
  markers: (peers: PeerHighlights, objectId: string) => readonly string[];
  objectIds: (peers: PeerHighlights) => readonly string[];
}

for (const { role, mark, markedObject, markers, objectIds } of kRoles) {
  describe(`${role} marks`, () => {
    test("orders the peers on one object by arrival", () => {
      const peers = new PeerHighlights();
      mark(peers, "peer-a", "box");
      mark(peers, "peer-b", "box");

      assert.deepStrictEqual(markers(peers, "box"), ["peer-a", "peer-b"]);
      assert.deepStrictEqual(objectIds(peers), ["box"]);
    });

    test("moving a peer removes it from its previous object", () => {
      const peers = new PeerHighlights();
      mark(peers, "peer-a", "box");
      mark(peers, "peer-b", "box");
      mark(peers, "peer-a", "cone");

      assert.strictEqual(markedObject(peers, "peer-a"), "cone");
      assert.deepStrictEqual(markers(peers, "box"), ["peer-b"]);
      assert.deepStrictEqual(new Set(objectIds(peers)), new Set(["box", "cone"]));
    });

    test("drops an object once its last peer clears", () => {
      const peers = new PeerHighlights();
      mark(peers, "peer-a", "box");
      mark(peers, "peer-a", null);

      assert.strictEqual(markedObject(peers, "peer-a"), null);
      assert.deepStrictEqual(objectIds(peers), []);
    });

    test("dispatches one change per move and none for a repeat", () => {
      const peers = new PeerHighlights();
      const details: PeerHighlightChangeEventDetail[] = [];
      peers.addEventListener("change", (event) => details.push(event.detail));

      mark(peers, "peer-a", "box");
      mark(peers, "peer-a", "box");
      mark(peers, "peer-a", "cone");

      assert.deepStrictEqual(details, [
        { peerId: "peer-a", role, objectId: "box", previousObjectId: null },
        { peerId: "peer-a", role, objectId: "cone", previousObjectId: "box" }
      ]);
    });
  });
}

describe("roles", () => {
  test("keep a peer's selection and hover independent", () => {
    const peers = new PeerHighlights();
    peers.select("peer-a", "box");
    peers.hover("peer-a", "cone");
    peers.hover("peer-a", null);

    assert.strictEqual(peers.selectedObject("peer-a"), "box");
    assert.deepStrictEqual(peers.hoveredObjectIds(), []);
  });
});

describe("removePeer", () => {
  test("clears both roles and releases the peer's color once", () => {
    const allocator = createStubColorAllocator();
    const peers = new PeerHighlights({ colorAllocator: allocator });
    peers.select("peer-a", "box");
    peers.hover("peer-a", "cone");

    peers.removePeer("peer-a");

    assert.strictEqual(peers.selectedObject("peer-a"), null);
    assert.strictEqual(peers.hoveredObject("peer-a"), null);
    assert.deepStrictEqual(allocator.released, ["peer-a"]);
  });
});

describe("peerColor", () => {
  test("delegates to the injected allocator", () => {
    const peers = new PeerHighlights({ colorAllocator: createStubColorAllocator() });

    assert.strictEqual(peers.peerColor("peer-a"), "stub:peer-a");
  });

  test("defaults to a palette color stable across instances", () => {
    const first = new PeerHighlights();
    first.peerColor("peer-b");

    assert.strictEqual(first.peerColor("peer-a"), new PeerHighlights().peerColor("peer-a"));
  });
});

describe("dispose", () => {
  test("clears every mark without releasing colors", () => {
    const allocator = createStubColorAllocator();
    const peers = new PeerHighlights({ colorAllocator: allocator });
    peers.select("peer-a", "box");
    peers.hover("peer-b", "box");

    peers.dispose();

    assert.deepStrictEqual(peers.selectors("box"), []);
    assert.deepStrictEqual(peers.hoverers("box"), []);
    assert.deepStrictEqual(allocator.released, []);
  });
});
