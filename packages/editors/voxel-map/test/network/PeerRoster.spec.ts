// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "../../src/EditorState.ts";
import { PeerRoster } from "../../src/network/PeerRoster.ts";
import {
  peerColor,
  type EditorIdentity
} from "../../src/network/identity.ts";

const kLocalIdentity: EditorIdentity = {
  username: "Ada",
  peerId: "local-peer",
  color: peerColor("ignored", { peerId: "local-peer" })
};

type RoomEvent = "sync" | "peer-joined" | "peer-left";

interface RosterHarness {
  roster: PeerRoster;
  addPeer(clientId: string, identity?: network.PeerMetadata): void;
  removePeer(clientId: string): void;
  emit(event: RoomEvent): void;
  listenerCount(event: RoomEvent): number;
}

function createHarness(): RosterHarness {
  const peerMap = new Map<string, network.Peer>();
  const listeners = new Map<string, Set<() => void>>();
  const room = {
    id: "voxel-room",
    clientId: "local",
    peers: peerMap,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: () => void 0,
    on: (event: string, listener: () => void) => {
      let bucket = listeners.get(event);
      if (!bucket) {
        bucket = new Set();
        listeners.set(event, bucket);
      }
      bucket.add(listener);
    },
    off: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }
  } as unknown as network.Room<any, any>;

  return {
    roster: new PeerRoster({
      room,
      identity: kLocalIdentity
    }),
    addPeer(clientId, identity = {}) {
      peerMap.set(clientId, {
        clientId,
        identity,
        presence: {}
      });
    },
    removePeer(clientId) {
      peerMap.delete(clientId);
    },
    emit(event) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    }
  };
}

function currentPeers(): readonly PresencePeer[] {
  return editorState.peers;
}

describe("PeerRoster", () => {
  afterEach(() => {
    editorState.setPeers([]);
  });

  test("publishes the local peer alone before anyone joins", () => {
    createHarness();

    assert.deepStrictEqual(currentPeers(), [
      {
        clientId: "local-peer",
        displayName: "Ada",
        color: kLocalIdentity.color,
        self: true
      }
    ]);
  });

  test("lists the members carried by the join sync", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });

    harness.emit("sync");

    assert.strictEqual(currentPeers().length, 2);
    assert.strictEqual(currentPeers()[1].displayName, "Alan");
  });

  test("keeps the local peer first and sorts the remote ones", () => {
    const harness = createHarness();
    harness.addPeer("client-z", { username: "Zoe", peerId: "z" });
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });

    harness.emit("peer-joined");

    assert.deepStrictEqual(
      currentPeers().map((peer) => peer.displayName),
      ["Ada", "Alan", "Zoe"]
    );
    assert.deepStrictEqual(
      currentPeers().map((peer) => peer.self ?? false),
      [true, false, false]
    );
  });

  test("colors a peer from its stamped peerId, not its connection id", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "shared" });

    harness.emit("peer-joined");

    assert.strictEqual(
      currentPeers()[1].color,
      peerColor("another-connection", { peerId: "shared" })
    );
  });

  test("reads a peer that joined without an identity as a guest", () => {
    const harness = createHarness();
    harness.addPeer("client-a");

    harness.emit("peer-joined");

    assert.strictEqual(currentPeers()[1].displayName, "Guest");
  });

  test("drops a peer that left", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });
    harness.emit("peer-joined");

    harness.removePeer("client-a");
    harness.emit("peer-left");

    assert.strictEqual(currentPeers().length, 1);
  });

  test("empties the roster and unsubscribes on dispose", () => {
    const harness = createHarness();

    harness.roster.dispose();

    assert.deepStrictEqual(currentPeers(), []);
    assert.strictEqual(harness.listenerCount("sync"), 0);
    assert.strictEqual(harness.listenerCount("peer-joined"), 0);
    assert.strictEqual(harness.listenerCount("peer-left"), 0);
  });
});
