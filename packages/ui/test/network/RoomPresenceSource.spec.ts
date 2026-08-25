// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata,
  Room,
  RoomEventMap
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { RoomPresenceSource } from "../../src/network/RoomPresenceSource.ts";

const kIdentity = {
  clientId: "me",
  displayName: "Me",
  color: "#f94144"
};

/**
 * Room test double that serializes presence patches like the wire.
 */
class FakeRoom implements Room {
  readonly id = "gallery";
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
    // Match the wire by dropping undefined during JSON serialization.
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
    type: keyof RoomEventMap
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener({});
    }
  }

  addPeer(
    transportId: string,
    stamp: Record<string, unknown>
  ): void {
    this.peers.set(transportId, {
      clientId: transportId,
      identity: {},
      presence: { jolly: stamp }
    });
  }
}

function createSource() {
  const room = new FakeRoom();

  return {
    room,
    source: new RoomPresenceSource(room, kIdentity)
  };
}

describe("RoomPresenceSource — identity", () => {
  test("takes its clientId from the host, not from room.clientId", () => {
    const { room, source } = createSource();

    assert.equal(source.clientId, "me");
    assert.notEqual(source.clientId, room.clientId);
  });

  test("stamps its identity into presence on construction", () => {
    const { room } = createSource();

    assert.deepEqual(room.patches, [
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
    const { room, source } = createSource();
    room.addPeer("transport-7", {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b",
      editing: null
    });

    assert.deepEqual([...source.peers.keys()], ["me", "ada"]);
    assert.equal(source.peers.get("ada")?.displayName, "Ada");
  });

  test("ignores a peer carrying no stamp", () => {
    const { room, source } = createSource();
    room.peers.set("transport-7", {
      clientId: "transport-7",
      identity: {},
      presence: {}
    });

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
    const { room, source } = createSource();
    room.addPeer("transport-7", {
      clientId: "ada",
      displayName: "Ada",
      color: "#43aa8b",
      editing: "map.width"
    });

    assert.equal(source.claim("map.width"), "contended");
    assert.equal(source.peers.get("me")?.editing, "map.width");
  });

  test("release publishes an explicit null, which survives serialization", () => {
    const { room, source } = createSource();
    source.claim("map.width");
    source.release("map.width");

    const last = room.patches.at(-1) as { jolly: Record<string, unknown>; };
    assert.equal("editing" in last.jolly, true);
    assert.equal(last.jolly.editing, null);
    assert.equal(source.peers.get("me")?.editing, undefined);
  });

  test("releasing a path it does not hold changes nothing", () => {
    const { room, source } = createSource();
    source.claim("map.width");
    const count = room.patches.length;
    source.release("map.height");

    assert.equal(room.patches.length, count);
    assert.equal(source.peers.get("me")?.editing, "map.width");
  });

  test("maps a null editing back to an absent field", () => {
    const { room, source } = createSource();
    room.addPeer("transport-7", {
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
    const { room, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    room.emit("sync");

    assert.equal(changes, 1);
  });

  test("re-publishes on sync, since a pre-join patch is dropped as not a member", () => {
    const { room } = createSource();
    room.patches.length = 0;

    room.emit("sync");

    assert.equal(room.patches.length, 1);
  });

  test("re-publishes on peer-joined, so a later joiner learns this identity", () => {
    const { room } = createSource();
    room.patches.length = 0;

    room.emit("peer-joined");

    assert.equal(room.patches.length, 1);
  });

  test("peer events fire change", () => {
    const { room, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    room.emit("peer-joined");
    room.emit("peer-presence");
    room.emit("peer-left");

    assert.equal(changes, 3);
  });

  test("dispose detaches from the room and from its listeners", () => {
    const { room, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    source.dispose();
    room.emit("peer-presence");

    assert.equal(changes, 0);
  });
});
