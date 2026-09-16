// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { GroupTransformLock } from "../../src/collaboration/GroupTransformLock.ts";
import { createRoomHarness } from "./roomHarness.ts";

function createLock() {
  const room = createRoomHarness();
  const lock = new GroupTransformLock({ room: room.room });

  return { ...room, lock };
}

describe("GroupTransformLock", () => {
  it("reports no lock when nobody claims the uuid", () => {
    const harness = createLock();

    assert.equal(harness.lock.lockedBy("uuid-1"), null);
    harness.lock.dispose();
  });

  it("does not lock the local peer out of its own claim", () => {
    const harness = createLock();

    harness.lock.claim("uuid-1");

    assert.equal(harness.lock.lockedBy("uuid-1"), null);
    assert.equal(harness.lock.heldUuid, "uuid-1");
    harness.lock.dispose();
  });

  it("publishes the claimed uuid to presence", () => {
    const harness = createLock();

    harness.lock.claim("uuid-1");

    assert.deepEqual(harness.published.at(-1), { transformLock: "uuid-1" });
    harness.lock.dispose();
  });

  it("publishes null on release", () => {
    const harness = createLock();
    harness.lock.claim("uuid-1");

    harness.lock.release();

    assert.deepEqual(harness.published.at(-1), { transformLock: null });
    assert.equal(harness.lock.heldUuid, null);
    harness.lock.dispose();
  });

  it("reports a remote peer holding the uuid after sync", () => {
    const harness = createLock();
    harness.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { transformLock: "uuid-1" }
    });

    harness.emit("sync");
    const holder = harness.lock.lockedBy("uuid-1");

    assert.equal(holder?.clientId, "bob");
    assert.equal(holder?.displayName, "Bob");
    assert.match(holder?.color ?? "", /^#[0-9a-f]{6}$/i);
    harness.lock.dispose();
  });

  it("tracks an incremental claim from a presence patch", () => {
    const harness = createLock();
    harness.addPeer("bob", { presence: {} });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { transformLock: "uuid-1" }
    });

    assert.equal(harness.lock.lockedBy("uuid-1")?.clientId, "bob");
    harness.lock.dispose();
  });

  it("ignores a presence patch without its own key", () => {
    const harness = createLock();
    harness.addPeer("bob", { presence: { transformLock: "uuid-1" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { block: "uuid-2" }
    });

    assert.equal(harness.lock.lockedBy("uuid-1")?.clientId, "bob");
    harness.lock.dispose();
  });

  it("clears a remote claim when the peer releases it", () => {
    const harness = createLock();
    harness.addPeer("bob", { presence: { transformLock: "uuid-1" } });
    harness.emit("sync");

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: { transformLock: null }
    });

    assert.equal(harness.lock.lockedBy("uuid-1"), null);
    harness.lock.dispose();
  });

  it("clears a remote claim when the peer leaves", () => {
    const harness = createLock();
    harness.addPeer("bob", { presence: { transformLock: "uuid-1" } });
    harness.emit("sync");

    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(harness.lock.lockedBy("uuid-1"), null);
    harness.lock.dispose();
  });

  it("breaks a double-claim tie by the lowest client id, excluding self", () => {
    const harness = createLock();
    harness.addPeer("zoe", { presence: { transformLock: "uuid-1" } });
    harness.addPeer("ada", { presence: { transformLock: "uuid-1" } });
    harness.emit("sync");

    assert.equal(harness.lock.lockedBy("uuid-1")?.clientId, "ada");
    harness.lock.dispose();
  });

  it("resolves the race in the local peer's favor when its own id wins the tie-break", () => {
    const harness = createLock();
    harness.lock.claim("uuid-1");
    harness.addPeer("zoe", { presence: { transformLock: "uuid-1" } });
    harness.emit("sync");

    assert.equal(harness.lock.lockedBy("uuid-1"), null);
    harness.lock.dispose();
  });

  it("notifies listeners on sync, presence patches and peer-left", () => {
    const harness = createLock();
    let notifications = 0;
    const unsubscribe = harness.lock.onChange(() => {
      notifications++;
    });

    harness.emit("sync");
    harness.emit("peer-presence", { clientId: "bob", patch: { transformLock: "uuid-1" } });
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(notifications, 3);
    unsubscribe();
    harness.lock.dispose();
  });

  it("stops notifying once unsubscribed", () => {
    const harness = createLock();
    let notifications = 0;
    const unsubscribe = harness.lock.onChange(() => {
      notifications++;
    });
    unsubscribe();

    harness.emit("sync");

    assert.equal(notifications, 0);
    harness.lock.dispose();
  });

  it("releases the local claim and stops listening on dispose", () => {
    const harness = createLock();
    harness.lock.claim("uuid-1");

    harness.lock.dispose();

    assert.deepEqual(harness.published.at(-1), { transformLock: null });
    assert.equal(harness.listenerCount("sync"), 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);
    assert.equal(harness.listenerCount("peer-left"), 0);
  });
});
