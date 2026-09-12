// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { PeerMarkTracker } from "../../src/collaboration/PeerMarkTracker.ts";
import type { PeerMarkMap } from "../../src/collaboration/peerMarks.ts";
import { createRoomHarness } from "./roomHarness.ts";

interface TrackerHarness extends ReturnType<typeof createRoomHarness> {
  tracker: PeerMarkTracker<string>;
  marks: () => PeerMarkMap<string>;
  setLocal: (key: string | null) => void;
}

function createTracker(): TrackerHarness {
  const room = createRoomHarness();
  let local: string | null = "local-key";
  let published: PeerMarkMap<string> = new Map();

  const tracker = new PeerMarkTracker<string>({
    room: room.room,
    presenceKey: "layer",
    localKey: () => local,
    readKey: readStringKey,
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
    }
  };
}

function readStringKey(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}

function clientIdsOf(
  marks: PeerMarkMap<string>
): [string, string[]][] {
  return [...marks].map(([key, bucket]) => [
    key,
    bucket.map((mark) => mark.clientId)
  ]);
}

describe("PeerMarkTracker", () => {
  it("publishes the local key on construction", () => {
    const harness = createTracker();

    assert.deepEqual(harness.published, [{ layer: "local-key" }]);
    harness.tracker.dispose();
  });

  it("publishes null when nothing is selected locally", () => {
    const harness = createTracker();
    harness.setLocal(null);
    harness.published.length = 0;

    harness.tracker.publishLocal();

    assert.deepEqual(harness.published, [{ layer: null }]);
    harness.tracker.dispose();
  });

  it("republishes on sync because a pre-join patch is dropped", () => {
    const harness = createTracker();
    harness.published.length = 0;

    harness.emit("sync");

    assert.deepEqual(harness.published, [{ layer: "local-key" }]);
    harness.tracker.dispose();
  });

  it("folds the peer keys known at sync time", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.addPeer("cleo", { presence: { layer: "a" } });
    harness.addPeer("dan", { presence: { layer: "b" } });

    harness.emit("sync");

    assert.deepEqual(clientIdsOf(harness.marks()), [
      ["a", ["bob", "cleo"]],
      ["b", ["dan"]]
    ]);
    harness.tracker.dispose();
  });

  it("orders the marks of a key by client id", () => {
    const harness = createTracker();
    harness.addPeer("zoe", { presence: { layer: "a" } });
    harness.addPeer("ada", { presence: { layer: "a" } });

    harness.emit("sync");

    assert.deepEqual(
      harness.marks().get("a")?.map((mark) => mark.clientId),
      ["ada", "zoe"]
    );
    harness.tracker.dispose();
  });

  it("never marks the local peer, which room.peers excludes", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "local-key" } });

    harness.emit("sync");

    assert.deepEqual(
      harness.marks().get("local-key")?.map((mark) => mark.clientId),
      ["bob"]
    );
    harness.tracker.dispose();
  });

  it("names and colors a mark from the peer identity", () => {
    const harness = createTracker();
    harness.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { layer: "a" }
    });

    harness.emit("sync");
    const [mark] = harness.marks().get("a") ?? [];

    assert.equal(mark.displayName, "Bob");
    assert.match(mark.color, /^#[0-9a-f]{6}$/i);
    harness.tracker.dispose();
  });

  it("moves a peer mark on a presence patch", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { layer: "b" }
    });

    assert.equal(harness.marks().has("a"), false);
    assert.deepEqual(
      harness.marks().get("b")?.map((mark) => mark.clientId),
      ["bob"]
    );
    harness.tracker.dispose();
  });

  it("ignores a presence patch without its own key", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: 3 }
    });

    assert.deepEqual(
      harness.marks().get("a")?.map((mark) => mark.clientId),
      ["bob"]
    );
    harness.tracker.dispose();
  });

  it("drops a mark when a peer clears its key", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { layer: null }
    });

    assert.equal(harness.marks().size, 0);
    harness.tracker.dispose();
  });

  it("drops a mark when a peer leaves", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.addPeer("cleo", { presence: { layer: "a" } });
    harness.emit("sync");

    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.deepEqual(
      harness.marks().get("a")?.map((mark) => mark.clientId),
      ["cleo"]
    );
    harness.tracker.dispose();
  });

  it("clears the marks and the listeners on dispose", () => {
    const harness = createTracker();
    harness.addPeer("bob", { presence: { layer: "a" } });
    harness.emit("sync");

    harness.tracker.dispose();

    assert.equal(harness.marks().size, 0);
    assert.equal(harness.listenerCount("sync"), 0);
    assert.equal(harness.listenerCount("peer-left"), 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);
  });
});
