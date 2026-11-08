// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { PeerMarkTracker } from "../../src/network/PeerMarkTracker.ts";
import { PeerMarks } from "../../src/peer/PeerMarks.ts";
import { createRoomHarness } from "../helpers/network/roomHarness.ts";

interface TrackerHarness extends ReturnType<typeof createRoomHarness> {
  tracker: PeerMarkTracker<string>;
  marks: () => PeerMarks<string>;
  setLocal: (key: string | null) => void;
  localListeners: () => number;
}

function createTracker(): TrackerHarness {
  const room = createRoomHarness();
  const listeners = new Set<() => void>();
  let local: string | null = "local-key";
  let published = new PeerMarks<string>();

  const tracker = new PeerMarkTracker<string>({
    room: room.room,
    presenceKey: "block",
    decode: (value) => (typeof value === "string" ? value : undefined),
    local: {
      read: () => local,
      subscribe: (listener) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
      }
    },
    publish: (marks) => {
      published = marks;
    }
  });

  return {
    ...room,
    tracker,
    marks: () => published,
    setLocal(key) {
      local = key;
      for (const listener of listeners) {
        listener();
      }
    },
    localListeners: () => listeners.size
  };
}

function clientIdsAt(
  marks: PeerMarks<string>,
  key: string
): string[] {
  return marks.peersAt(key).map((peer) => peer.clientId);
}

describe("PeerMarkTracker", () => {
  it("publishes the local key on construction", () => {
    const harness = createTracker();

    assert.deepEqual(harness.published, [{ block: "local-key" }]);
    harness.tracker.dispose();
  });

  it("publishes null when nothing is selected locally", () => {
    const harness = createTracker();
    harness.published.length = 0;

    harness.setLocal(null);

    assert.deepEqual(harness.published, [{ block: null }]);
    harness.tracker.dispose();
  });

  it("does not republish an unchanged local key", () => {
    const harness = createTracker();
    harness.published.length = 0;

    harness.setLocal("local-key");

    assert.deepEqual(harness.published, []);
    harness.tracker.dispose();
  });

  it("folds the peer keys known at sync time", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.addPeer("cleo", { presence: { block: "a" } });
    harness.addPeer("dan", { presence: { block: "b" } });

    harness.emit("sync");

    assert.deepEqual(clientIdsAt(harness.marks(), "a"), ["bob", "cleo"]);
    assert.deepEqual(clientIdsAt(harness.marks(), "b"), ["dan"]);
    harness.tracker.dispose();
  });

  it("orders the marks of a key by client id", () => {
    const harness = createTracker();
    harness.addPeer("zoe", { presence: { block: "a" } });
    harness.addPeer("ada", { presence: { block: "a" } });

    harness.emit("sync");

    assert.deepEqual(clientIdsAt(harness.marks(), "a"), ["ada", "zoe"]);
    harness.tracker.dispose();
  });

  it("names and colors a mark from the peer identity", () => {
    const harness = createTracker();
    harness.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { block: "a" }
    });

    harness.emit("sync");
    const [mark] = harness.marks().peersAt("a");

    assert.equal(mark.displayName, "Bob");
    assert.match(mark.color, /^#[0-9a-f]{6}$/i);
    harness.tracker.dispose();
  });

  it("renames a mark when the peer profile changes", () => {
    const harness = createTracker();
    harness.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { block: "a" }
    });
    harness.emit("sync");

    harness.addPeer("bob", {
      profile: { username: "Robert", peerId: "bob" },
      presence: { block: "a" }
    });
    harness.emit("peer-profile", { clientId: "bob" });

    assert.equal(harness.marks().peersAt("a")[0].displayName, "Robert");
    harness.tracker.dispose();
  });

  it("moves a peer mark on a presence patch", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: "b" }
    });

    assert.deepEqual(clientIdsAt(harness.marks(), "a"), []);
    assert.deepEqual(clientIdsAt(harness.marks(), "b"), ["bob"]);
    harness.tracker.dispose();
  });

  it("ignores a presence patch without its own key", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { frustum: {} }
    });

    assert.deepEqual(clientIdsAt(harness.marks(), "a"), ["bob"]);
    harness.tracker.dispose();
  });

  it("drops a mark when a peer clears its key", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: null }
    });

    assert.equal(harness.marks().size, 0);
    harness.tracker.dispose();
  });

  it("drops a mark when a peer leaves", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.addPeer("cleo", { presence: { block: "a" } });
    harness.emit("sync");

    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.deepEqual(clientIdsAt(harness.marks(), "a"), ["cleo"]);
    harness.tracker.dispose();
  });

  it("clears the marks and every listener on dispose", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { block: "a" } });
    harness.emit("sync");

    harness.tracker.dispose();

    assert.equal(harness.marks().size, 0);
    assert.equal(harness.localListeners(), 0);
    assert.equal(harness.listenerCount("sync"), 0);
    assert.equal(harness.listenerCount("peer-left"), 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);
    assert.equal(harness.listenerCount("peer-profile"), 0);
  });
});
