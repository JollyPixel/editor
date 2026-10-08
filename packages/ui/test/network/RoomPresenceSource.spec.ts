// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { RoomPresenceSource } from "../../src/network/RoomPresenceSource.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "../helpers/network/roomHarness.ts";

const kIdentity = {
  clientId: "me",
  displayName: "Me",
  color: "#f94144"
};

function createSource() {
  const harness = createRoomHarness();

  return {
    harness,
    source: new RoomPresenceSource(harness.room, kIdentity)
  };
}

function addStampedPeer(
  harness: RoomHarness,
  transportId: string,
  stamp: PeerMetadata
): void {
  harness.addPeer(transportId, {
    presence: {
      jolly: stamp
    }
  });
}

describe("RoomPresenceSource — identity", () => {
  test("takes its clientId from the host, not from room.clientId", () => {
    const { harness, source } = createSource();

    assert.equal(source.clientId, "me");
    assert.notEqual(source.clientId, harness.room.clientId);
  });

  test("stamps its identity into presence on construction", () => {
    const { harness } = createSource();

    assert.deepEqual(harness.published, [
      {
        jolly: {
          clientId: "me",
          displayName: "Me",
          color: "#f94144",
          editing: null
        }
      }
    ]);
  });

  test("synthesizes the local peer, which room.peers never holds", () => {
    const { source } = createSource();

    assert.deepEqual([...source.peers.keys()], ["me"]);
  });

  test("keys remote peers by their stamped id, not their transport id", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b",
      editing: null
    });

    assert.deepEqual([...source.peers.keys()], ["me", "ada"]);
    assert.equal(source.peers.get("ada")?.displayName, "Ada");
  });

  test("ignores a peer carrying no stamp", () => {
    const { harness, source } = createSource();
    harness.addPeer("transport-7", { presence: {} });

    assert.deepEqual([...source.peers.keys()], ["me"]);
  });
});

describe("RoomPresenceSource — claim and release", () => {
  test("an uncontended claim is held", () => {
    const { source } = createSource();

    assert.equal(source.claim("map.width"), "held");
    assert.equal(source.peers.get("me")?.editing, "map.width");
  });

  test("a claim on a path a remote peer holds is contended, and still claims", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b",
      editing: "map.width"
    });

    assert.equal(source.claim("map.width"), "contended");
    assert.equal(source.peers.get("me")?.editing, "map.width");
  });

  test("release publishes an explicit null, which survives serialization", () => {
    const { harness, source } = createSource();
    source.claim("map.width");
    source.release("map.width");

    const last = harness.published.at(-1) as { jolly: Record<string, unknown>; };
    assert.equal("editing" in last.jolly, true);
    assert.equal(last.jolly.editing, null);
    assert.equal(source.peers.get("me")?.editing, undefined);
  });

  test("releasing a path it does not hold changes nothing", () => {
    const { harness, source } = createSource();
    source.claim("map.width");
    const count = harness.published.length;
    source.release("map.height");

    assert.equal(harness.published.length, count);
    assert.equal(source.peers.get("me")?.editing, "map.width");
  });

  test("maps a null editing back to an absent field", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b",
      editing: null
    });

    assert.equal("editing" in source.peers.get("ada")!, false);
  });
});

describe("RoomPresenceSource — change notification", () => {
  test("a sync fires change, so a late joiner is not blind to peers already present", () => {
    const { harness, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    harness.emit("sync");

    assert.equal(changes, 1);
  });

  test("never re-publishes on sync or peer-joined, the join carries its presence", () => {
    const { harness } = createSource();
    harness.published.length = 0;

    harness.emit("sync");
    harness.emit("peer-joined");

    assert.equal(harness.published.length, 0);
  });

  test("peer events fire change", () => {
    const { harness, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    harness.emit("peer-joined");
    harness.emit("peer-presence");
    harness.emit("peer-left");

    assert.equal(changes, 3);
  });

  test("dispose detaches from the room and from its listeners", () => {
    const { harness, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    source.dispose();
    harness.emit("peer-presence");

    assert.equal(changes, 0);
  });
});

describe("RoomPresenceSource — repeated reads", () => {
  const kAda = {
    clientId: "ada",
    displayName: "Ada",
    color: "#43aa8b",
    editing: "map.width"
  };

  test("returns the same presence objects while nothing changed", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", { ...kAda });

    const first = source.peers;
    addStampedPeer(harness, "transport-7", { ...kAda });
    const second = source.peers;

    assert.equal(second.get("me"), first.get("me"));
    assert.equal(second.get("ada"), first.get("ada"));
  });

  test("rebuilds a remote presence whose stamp changed", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", { ...kAda });

    const before = source.peers.get("ada");
    addStampedPeer(harness, "transport-7", { ...kAda, editing: null });
    const after = source.peers.get("ada");

    assert.notEqual(after, before);
    assert.deepEqual(after, {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b"
    });
  });

  test("rebuilds the local presence when it claims a path", () => {
    const { source } = createSource();

    const before = source.peers.get("me");
    source.claim("map.width");
    const after = source.peers.get("me");

    assert.notEqual(after, before);
    assert.equal(after?.editing, "map.width");
  });

  test("follows room changes made without an event", () => {
    const { harness, source } = createSource();
    addStampedPeer(harness, "transport-7", { ...kAda });
    assert.deepEqual([...source.peers.keys()], ["me", "ada"]);

    harness.removePeer("transport-7");

    assert.deepEqual([...source.peers.keys()], ["me"]);
  });
});
