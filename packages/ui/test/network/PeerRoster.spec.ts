// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";

// Import Internal Dependencies
import { peerProfileColor } from "../../src/network/peerProfile.ts";
import {
  LOCAL_PROFILE,
  createRosterHarness,
  readMessages
} from "../helpers/network/rosterHarness.ts";

describe("PeerRoster", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("publishes the local peer alone, keyed by its connection, before anyone joins", () => {
    const harness = createRosterHarness();

    assert.deepStrictEqual(harness.peers(), [
      {
        clientId: harness.room.clientId,
        displayName: "Ada",
        color: peerProfileColor("ignored", LOCAL_PROFILE),
        peerId: "local-peer",
        avatar: undefined,
        self: true
      }
    ]);
  });

  test("lists the members carried by the join sync", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("sync");

    assert.strictEqual(harness.peers().length, 2);
    assert.strictEqual(harness.peers()[1].displayName, "Alan");
  });

  test("keeps the local peer first and sorts the remote ones", () => {
    const harness = createRosterHarness();
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
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "shared" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(
      harness.peers()[1].color,
      peerProfileColor("another-connection", { peerId: "shared" })
    );
  });

  test("keys a remote avatar on the stamped peerId and carries its image", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", {
      profile: {
        username: "Alan",
        peerId: "a",
        avatar: "/api/accounts/a/avatar?v=2"
      }
    });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers()[1].peerId, "a");
    assert.strictEqual(harness.peers()[1].avatar, "/api/accounts/a/avatar?v=2");
  });

  test("leaves the peerId and avatar of an unstamped peer to the presence defaults", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: {} });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers()[1].peerId, undefined);
    assert.strictEqual(harness.peers()[1].avatar, undefined);
  });

  test("reads a peer that joined without an identity as a guest", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: {} });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers()[1].displayName, "Guest");
  });

  test("drops a peer that left", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-a" });

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });

    assert.strictEqual(harness.peers().length, 1);
  });

  test("announces a peer that joined", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.deepStrictEqual(readMessages(harness.log), ["Alan has joined"]);
  });

  test("leaves an observer out of the roster and never announces it", () => {
    const harness = createRosterHarness();
    harness.addPeer("preview", {
      profile: {
        ...LOCAL_PROFILE,
        observer: true
      }
    });

    harness.emit("peer-joined", { clientId: "preview" });
    assert.deepStrictEqual(
      harness.peers().map(({ clientId }) => clientId),
      ["local"]
    );
    harness.removePeer("preview");
    harness.emit("peer-left", { clientId: "preview" });

    assert.deepStrictEqual(readMessages(harness.log), []);
  });

  test("announces a peer that left under its last known name", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-a" });

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });

    assert.deepStrictEqual(readMessages(harness.log), [
      "Alan has left",
      "Alan has joined"
    ]);
  });

  test("says nothing for the members carried by the join sync", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("sync");

    assert.deepStrictEqual(readMessages(harness.log), []);
  });

  test("says nothing about the local peer", () => {
    const harness = createRosterHarness();

    harness.emit("peer-joined", { clientId: harness.room.clientId });

    assert.deepStrictEqual(readMessages(harness.log), []);
  });

  test("tracks peers without a log", () => {
    const harness = createRosterHarness({ log: false });
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("peer-joined", { clientId: "client-a" });

    assert.strictEqual(harness.peers().length, 2);
  });

  test("empties the roster and unsubscribes on dispose", () => {
    const harness = createRosterHarness();

    harness.roster.dispose();

    assert.deepStrictEqual(harness.peers(), []);
    assert.strictEqual(harness.listenerCount("sync"), 0);
    assert.strictEqual(harness.listenerCount("peer-joined"), 0);
    assert.strictEqual(harness.listenerCount("peer-left"), 0);
    assert.strictEqual(harness.listenerCount("peer-profile"), 0);
  });
});
