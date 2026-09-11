// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { render } from "lit";
import type * as network from "@jolly-pixel/network";
import {
  LogQueue,
  type PresencePeer
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  editorState,
  ShellStore
} from "../../src/app/state/index.ts";
import { PeerRoster } from "../../src/collaboration/PeerRoster.ts";
import {
  peerColor,
  type EditorIdentity
} from "../../src/collaboration/identity.ts";

const kLocalIdentity: EditorIdentity = {
  username: "Ada",
  peerId: "local-peer",
  color: peerColor("ignored", { peerId: "local-peer" })
};

type RoomEvent = "sync" | "peer-joined" | "peer-left";

interface RosterHarness {
  roster: PeerRoster;
  log: LogQueue;
  addPeer(clientId: string, identity?: network.PeerMetadata): void;
  removePeer(clientId: string): void;
  emit(event: RoomEvent, clientId?: string): void;
  listenerCount(event: RoomEvent): number;
}

function createHarness(
  shell: ShellStore = editorState.shell,
  log: LogQueue = new LogQueue()
): RosterHarness {
  const peerMap = new Map<string, network.Peer>();
  const listeners = new Map<string, Set<(event: { clientId: string; }) => void>>();
  const room = {
    id: "voxel-room",
    clientId: "local",
    peers: peerMap,

    role: "default",

    rights: {},

    access: "write" as const,

    can: () => "write" as const,
    join: () => void 0,
    leave: () => void 0,
    send: () => void 0,
    updatePresence: () => void 0,
    on: (event: string, listener: (event: { clientId: string; }) => void) => {
      let bucket = listeners.get(event);
      if (!bucket) {
        bucket = new Set();
        listeners.set(event, bucket);
      }
      bucket.add(listener);
    },
    off: (event: string, listener: (event: { clientId: string; }) => void) => {
      listeners.get(event)?.delete(listener);
    }
  } as unknown as network.Room<any, any>;

  return {
    log,
    roster: new PeerRoster({
      room,
      identity: kLocalIdentity,
      shell,
      log
    }),
    addPeer(clientId, profile = {}) {
      peerMap.set(clientId, {
        clientId,
        role: "default",
        profile,
        presence: {}
      });
    },
    removePeer(clientId) {
      peerMap.delete(clientId);
    },
    emit(event, clientId = "client-a") {
      for (const listener of listeners.get(event) ?? []) {
        listener({ clientId });
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0;
    }
  };
}

function currentPeers(): readonly PresencePeer[] {
  return editorState.shell.peers;
}

function messagesOf(
  log: LogQueue
): string[] {
  return log.entries.map((entry) => {
    const container = document.createElement("div");
    render(entry.content, container);

    return container.textContent?.trim() ?? "";
  });
}

describe("PeerRoster", () => {
  afterEach(() => {
    editorState.shell.peers = [];
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

  test("publishes through the injected shell store", () => {
    const shell = new ShellStore();

    createHarness(shell);

    assert.strictEqual(shell.peers[0].displayName, "Ada");
    assert.deepStrictEqual(editorState.shell.peers, []);
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

  test("announces a peer that joined", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });

    harness.emit("peer-joined", "client-a");

    assert.deepStrictEqual(messagesOf(harness.log), ["Alan has joined"]);
  });

  test("announces a peer that left under its last known name", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });
    harness.emit("peer-joined", "client-a");

    harness.removePeer("client-a");
    harness.emit("peer-left", "client-a");

    assert.deepStrictEqual(messagesOf(harness.log), [
      "Alan has left",
      "Alan has joined"
    ]);
  });

  test("says nothing for the members carried by the join sync", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { username: "Alan", peerId: "a" });

    harness.emit("sync");

    assert.deepStrictEqual(messagesOf(harness.log), []);
  });

  test("says nothing about the local peer", () => {
    const harness = createHarness();

    harness.emit("peer-joined", "local-peer");

    assert.deepStrictEqual(messagesOf(harness.log), []);
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
