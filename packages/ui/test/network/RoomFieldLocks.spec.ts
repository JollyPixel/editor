// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ColorSequence } from "@jolly-pixel/color";

// Import Internal Dependencies
import { RoomFieldLocks } from "../../src/network/RoomFieldLocks.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "../helpers/network/roomHarness.ts";

// CONSTANTS
const kSelf = "local";

function createLocks() {
  const harness = createRoomHarness({
    username: "Me",
    peerId: "account-1"
  });

  return {
    harness,
    locks: new RoomFieldLocks(harness.room)
  };
}

function joinPeer(
  harness: RoomHarness,
  clientId: string,
  fieldLock: string | null = null
): void {
  harness.addPeer(clientId, {
    profile: {
      username: clientId,
      peerId: `peer-${clientId}`
    },
    presence: { fieldLock }
  });
  harness.emit("peer-joined", { clientId });
}

function patchPresence(
  harness: RoomHarness,
  clientId: string,
  patch: Record<string, unknown>
): void {
  harness.emit("peer-presence", { clientId, patch });
}

function editorIds(
  locks: RoomFieldLocks,
  path: string
): string[] {
  return locks.editors(path).map((peer) => peer.clientId);
}

describe("RoomFieldLocks — editors", () => {
  test("lists the local peer, keyed by its connection, once it claims", () => {
    const { locks } = createLocks();
    locks.claim("map.width");

    const [local] = locks.editors("map.width");

    assert.equal(local.clientId, kSelf);
    assert.equal(local.self, true);
  });

  test("tells two connections of one account apart", () => {
    const { harness, locks } = createLocks();
    harness.addPeer("transport-7", {
      profile: { username: "Me", peerId: "account-1" },
      presence: { fieldLock: "map.width" }
    });
    harness.emit("peer-joined", { clientId: "transport-7" });

    const [editor] = locks.editors("map.width");

    assert.equal(editor.clientId, "transport-7");
    assert.notEqual(editor.self, true);
  });

  test("names and colors a remote editor from its profile", () => {
    const { harness, locks } = createLocks();
    joinPeer(harness, "ada", "map.width");

    const [ada] = locks.editors("map.width");

    assert.equal(ada.displayName, "ada");
    assert.equal(ada.color, ColorSequence.default.pick("peer-ada"));
  });

  test("leaves an observer out", () => {
    const { harness, locks } = createLocks();
    harness.addPeer("preview", {
      profile: {
        username: "Me",
        peerId: "account-1",
        observer: true
      },
      presence: { fieldLock: "map.width" }
    });
    harness.emit("peer-joined", { clientId: "preview" });

    assert.deepEqual(editorIds(locks, "map.width"), []);
  });

  test("lists every client's editors in the same order, whatever order they joined in", () => {
    const forward = createLocks();
    joinPeer(forward.harness, "lin", "map.width");
    joinPeer(forward.harness, "ada", "map.width");
    const reversed = createLocks();
    joinPeer(reversed.harness, "ada", "map.width");
    joinPeer(reversed.harness, "lin", "map.width");

    assert.deepEqual(editorIds(forward.locks, "map.width"), ["ada", "lin"]);
    assert.deepEqual(editorIds(reversed.locks, "map.width"), ["ada", "lin"]);
  });

  test("puts the local peer first on a path a remote peer also holds", () => {
    const { harness, locks } = createLocks();
    joinPeer(harness, "ada", "map.width");

    locks.claim("map.width");

    assert.deepEqual(editorIds(locks, "map.width"), [kSelf, "ada"]);
  });
});

describe("RoomFieldLocks — claim and release", () => {
  test("a second claim replaces the first without releasing in between", () => {
    const { harness, locks } = createLocks();
    locks.claim("map.width");
    locks.claim("map.height");

    assert.deepEqual(harness.published, [
      { fieldLock: "map.width" },
      { fieldLock: "map.height" }
    ]);
    assert.deepEqual(editorIds(locks, "map.width"), []);
    assert.deepEqual(editorIds(locks, "map.height"), [kSelf]);
  });

  test("release publishes an explicit null, which survives serialization", () => {
    const { harness, locks } = createLocks();
    locks.claim("map.width");
    locks.release("map.width");

    assert.deepEqual(harness.published.at(-1), { fieldLock: null });
    assert.deepEqual(editorIds(locks, "map.width"), []);
  });

  test("releasing a path it does not hold changes nothing", () => {
    const { harness, locks } = createLocks();
    locks.claim("map.width");
    const count = harness.published.length;
    locks.release("map.height");

    assert.equal(harness.published.length, count);
    assert.deepEqual(editorIds(locks, "map.width"), [kSelf]);
  });

  test("follows a remote claim and its release", () => {
    const { harness, locks } = createLocks();
    joinPeer(harness, "ada");

    patchPresence(harness, "ada", { fieldLock: "map.width" });
    assert.deepEqual(editorIds(locks, "map.width"), ["ada"]);

    patchPresence(harness, "ada", { fieldLock: null });
    assert.deepEqual(editorIds(locks, "map.width"), []);
  });
});

describe("RoomFieldLocks — change notification", () => {
  test("a sync fires change, so a late joiner is not blind to peers already present", () => {
    const { harness, locks } = createLocks();
    let changes = 0;
    locks.subscribe(() => {
      changes++;
    });

    harness.emit("sync");

    assert.equal(changes, 1);
  });

  test("publishes nothing until it claims, the join carries its presence", () => {
    const { harness } = createLocks();

    harness.emit("sync");
    joinPeer(harness, "ada");

    assert.deepEqual(harness.published, []);
  });

  test("ignores presence patches under other keys", () => {
    const { harness, locks } = createLocks();
    joinPeer(harness, "ada", "map.width");
    const before = locks.editors("map.width");
    let changes = 0;
    locks.subscribe(() => {
      changes++;
    });

    patchPresence(harness, "ada", { cursor: [1, 2] });

    assert.equal(changes, 0);
    assert.equal(locks.editors("map.width"), before);
  });

  test("dispose detaches from the room and from its listeners", () => {
    const { harness, locks } = createLocks();
    let changes = 0;
    locks.subscribe(() => {
      changes++;
    });

    locks.dispose();
    joinPeer(harness, "ada", "map.width");

    assert.equal(changes, 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);
    assert.equal(harness.listenerCount("sync"), 0);
  });
});

describe("RoomFieldLocks — repeated reads", () => {
  test("returns the same editors while nothing changed", () => {
    const { harness, locks } = createLocks();
    joinPeer(harness, "ada", "map.width");

    assert.equal(locks.editors("map.width"), locks.editors("map.width"));
  });

  test("rebuilds the editors when it claims a path", () => {
    const { locks } = createLocks();

    const before = locks.editors("map.width");
    locks.claim("map.width");

    assert.notEqual(locks.editors("map.width"), before);
  });
});
