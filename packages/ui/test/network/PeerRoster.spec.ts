// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { render } from "lit";

// Import Internal Dependencies
import { LogQueue } from "../../src/feedback/LogQueue.ts";
import type { PeerIdentity } from "../../src/peer/identity.ts";
import type { PresencePeer } from "../../src/peer/Presence.ts";
import { PeerRoster } from "../../src/network/PeerRoster.ts";
import { peerProfileColor } from "../../src/network/peerProfile.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "./roomHarness.ts";

const kLocalIdentity: PeerIdentity = {
  username: "Ada",
  peerId: "local-peer",
  color: peerProfileColor("ignored", { peerId: "local-peer" })
};

interface RosterHarness extends RoomHarness {
  roster: PeerRoster;
  log: LogQueue;
  peers: () => readonly PresencePeer[];
}

function createHarness(
  options: { log?: boolean; } = {}
): RosterHarness {
  const harness = createRoomHarness();
  const log = new LogQueue();
  let peers: readonly PresencePeer[] = [];

  const roster = new PeerRoster({
    room: harness.room,
    identity: kLocalIdentity,
    publish: (next) => {
      peers = next;
    },
    log: options.log === false ? undefined : log
  });

  return {
    ...harness,
    roster,
    log,
    peers: () => peers
  };
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
  test("publishes the local peer alone before anyone joins", () => {
    const harness = createHarness();

    assert.deepStrictEqual(harness.peers(), [
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
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("sync");

    assert.strictEqual(harness.peers().length, 2);
    assert.strictEqual(harness.peers()[1].displayName, "Alan");
  });

  test("keeps the local peer first and sorts the remote ones", () => {
    const harness = createHarness();
    harness.addPeer("client-z", { profile: { username: "Zoe", peerId: "z" } });
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.deepStrictEqual(
      harness.peers().map((peer) => peer.displayName),
      ["Ada", "Alan", "Zoe"]
    );
    assert.deepStrictEqual(
      harness.peers().map((peer) => peer.self ?? false),
      [true, false, false]
    );
  });

  test("colors a peer from its stamped peerId, not its connection id", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "shared" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(
      harness.peers()[1].color,
      peerProfileColor("another-connection", { peerId: "shared" })
    );
  });

  test("reads a peer that joined without an identity as a guest", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: {} });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers()[1].displayName, "Guest");
  });

  test("drops a peer that left", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-a" });

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });

    assert.strictEqual(harness.peers().length, 1);
  });

  test("announces a peer that joined", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.deepStrictEqual(messagesOf(harness.log), ["Alan has joined"]);
  });

  test("announces a peer that left under its last known name", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-a" });

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });

    assert.deepStrictEqual(messagesOf(harness.log), [
      "Alan has left",
      "Alan has joined"
    ]);
  });

  test("says nothing for the members carried by the join sync", () => {
    const harness = createHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("sync");

    assert.deepStrictEqual(messagesOf(harness.log), []);
  });

  test("says nothing about the local peer", () => {
    const harness = createHarness();

    harness.emit("peer-joined", { clientId: "local-peer" });

    assert.deepStrictEqual(messagesOf(harness.log), []);
  });

  test("tracks peers without a log", () => {
    const harness = createHarness({ log: false });
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers().length, 2);
  });

  test("empties the roster and unsubscribes on dispose", () => {
    const harness = createHarness();

    harness.roster.dispose();

    assert.deepStrictEqual(harness.peers(), []);
    assert.strictEqual(harness.listenerCount("sync"), 0);
    assert.strictEqual(harness.listenerCount("peer-joined"), 0);
    assert.strictEqual(harness.listenerCount("peer-left"), 0);
  });
});
