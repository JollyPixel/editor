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
import {
  LOCAL_PROFILE,
  createRosterHarness,
  readMessages
} from "../helpers/network/rosterHarness.ts";

describe("PeerRoster people", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("lists a person once across their connections, under the first connection id", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-b", { profile: { username: "Alan", peerId: "a" } });
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });

    harness.emit("sync");

    assert.deepStrictEqual(
      harness.peers().map(({ clientId }) => clientId),
      ["local", "client-a"]
    );
  });

  test("folds the other connections of the local person into the self entry", () => {
    const harness = createRosterHarness();
    harness.addPeer("other-tab", { profile: LOCAL_PROFILE });

    harness.emit("peer-joined", { clientId: "other-tab" });

    assert.deepStrictEqual(
      harness.peers().map(({ clientId, self }) => [clientId, self]),
      [["local", true]]
    );
  });

  test("shows the activity of whichever connection of a person reports one", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.addPeer("client-b", {
      profile: { username: "Alan", peerId: "a" },
      presence: { activity: { label: "Placing trees" } }
    });

    harness.emit("sync");

    assert.deepStrictEqual(
      harness.peers().map(({ clientId, activity }) => [clientId, activity]),
      [["local", undefined], ["client-a", "Placing trees"]]
    );
  });

  test("announces a person on their first connection and after their last one", () => {
    const harness = createRosterHarness();
    harness.addPeer("client-a", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-a" });
    harness.addPeer("client-b", { profile: { username: "Alan", peerId: "a" } });
    harness.emit("peer-joined", { clientId: "client-b" });

    harness.removePeer("client-a");
    harness.emit("peer-left", { clientId: "client-a" });
    assert.deepStrictEqual(readMessages(harness.log), ["Alan has joined"]);
    harness.removePeer("client-b");
    harness.emit("peer-left", { clientId: "client-b" });

    assert.deepStrictEqual(readMessages(harness.log), [
      "Alan has left",
      "Alan has joined"
    ]);
  });

  test("never announces another connection of the local person", () => {
    const harness = createRosterHarness();
    harness.addPeer("other-tab", { profile: LOCAL_PROFILE });

    harness.emit("peer-joined", { clientId: "other-tab" });
    harness.removePeer("other-tab");
    harness.emit("peer-left", { clientId: "other-tab" });

    assert.deepStrictEqual(readMessages(harness.log), []);
  });
});
