// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import { RoomPresenceSource } from "../../src/network/RoomPresenceSource.ts";
import { resolveLock } from "../../src/peer/resolveLock.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "../helpers/network/roomHarness.ts";

// CONSTANTS
const kSelf = "local";

function createSource() {
  const harness = createRoomHarness({
    username: "Me",
    peerId: "account-1"
  });

  return {
    harness,
    source: new RoomPresenceSource(harness.room)
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

describe("RoomPresenceSource — identity", () => {
  test("keys the local peer by its connection", () => {
    const { source } = createSource();

    assert.equal(source.clientId, kSelf);
    assert.deepEqual([...source.peers.keys()], [kSelf]);
  });

  test("tells two connections of one account apart", () => {
    const { harness, source } = createSource();
    harness.addPeer("transport-7", {
      profile: { username: "Me", peerId: "account-1" },
      presence: { fieldLock: "map.width" }
    });
    harness.emit("peer-joined", { clientId: "transport-7" });

    const lock = resolveLock(source.peers.values(), "map.width", source.clientId);

    assert.deepEqual([...source.peers.keys()], [kSelf, "transport-7"]);
    assert.equal(lock.lockedBy?.clientId, "transport-7");
  });

  test("names and colors a remote peer from its profile", () => {
    const { harness, source } = createSource();
    joinPeer(harness, "ada");

    const ada = source.peers.get("ada");

    assert.equal(ada?.displayName, "ada");
    assert.equal(ada?.color, colorFromKey("peer-ada"));
  });

  test("lists a peer that never claimed a path", () => {
    const { harness, source } = createSource();
    harness.addPeer("ada");
    harness.emit("peer-joined", { clientId: "ada" });

    assert.deepEqual([...source.peers.keys()], [kSelf, "ada"]);
    assert.equal("editing" in source.peers.get("ada")!, false);
  });
});

describe("RoomPresenceSource — claim and release", () => {
  test("an uncontended claim is held", () => {
    const { source } = createSource();

    assert.equal(source.claim("map.width"), "held");
    assert.equal(source.peers.get(kSelf)?.editing, "map.width");
  });

  test("a claim on a path a remote peer holds is contended, and still claims", () => {
    const { harness, source } = createSource();
    joinPeer(harness, "ada", "map.width");

    assert.equal(source.claim("map.width"), "contended");
    assert.equal(source.peers.get(kSelf)?.editing, "map.width");
  });

  test("a second claim replaces the first without releasing in between", () => {
    const { harness, source } = createSource();
    source.claim("map.width");
    source.claim("map.height");

    assert.deepEqual(harness.published, [
      { fieldLock: "map.width" },
      { fieldLock: "map.height" }
    ]);
    assert.equal(source.peers.get(kSelf)?.editing, "map.height");
  });

  test("release publishes an explicit null, which survives serialization", () => {
    const { harness, source } = createSource();
    source.claim("map.width");
    source.release("map.width");

    assert.deepEqual(harness.published.at(-1), { fieldLock: null });
    assert.equal(source.peers.get(kSelf)?.editing, undefined);
  });

  test("releasing a path it does not hold changes nothing", () => {
    const { harness, source } = createSource();
    source.claim("map.width");
    const count = harness.published.length;
    source.release("map.height");

    assert.equal(harness.published.length, count);
    assert.equal(source.peers.get(kSelf)?.editing, "map.width");
  });

  test("follows a remote claim and its release", () => {
    const { harness, source } = createSource();
    joinPeer(harness, "ada");

    patchPresence(harness, "ada", { fieldLock: "map.width" });
    assert.equal(source.peers.get("ada")?.editing, "map.width");

    patchPresence(harness, "ada", { fieldLock: null });
    assert.equal("editing" in source.peers.get("ada")!, false);
  });
});

describe("RoomPresenceSource — change notification", () => {
  test("a sync fires change, so a late joiner is not blind to peers already present", () => {
    const { harness, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    harness.emit("sync");

    assert.equal(changes, 1);
  });

  test("publishes nothing until it claims, the join carries its presence", () => {
    const { harness } = createSource();

    harness.emit("sync");
    joinPeer(harness, "ada");

    assert.deepEqual(harness.published, []);
  });

  test("ignores presence patches under other keys", () => {
    const { harness, source } = createSource();
    joinPeer(harness, "ada");
    const before = source.peers;
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    patchPresence(harness, "ada", { cursor: [1, 2] });

    assert.equal(changes, 0);
    assert.equal(source.peers, before);
  });

  test("dispose detaches from the room and from its listeners", () => {
    const { harness, source } = createSource();
    let changes = 0;
    source.on("change", () => {
      changes++;
    });

    source.dispose();
    joinPeer(harness, "ada", "map.width");

    assert.equal(changes, 0);
    assert.equal(harness.listenerCount("peer-presence"), 0);
    assert.equal(harness.listenerCount("sync"), 0);
  });
});

describe("RoomPresenceSource — repeated reads", () => {
  test("returns the same presence objects while nothing changed", () => {
    const { harness, source } = createSource();
    joinPeer(harness, "ada", "map.width");

    const first = source.peers;
    const second = source.peers;

    assert.equal(second.get(kSelf), first.get(kSelf));
    assert.equal(second.get("ada"), first.get("ada"));
  });

  test("rebuilds the local presence when it claims a path", () => {
    const { source } = createSource();

    const before = source.peers.get(kSelf);
    source.claim("map.width");
    const after = source.peers.get(kSelf);

    assert.notEqual(after, before);
    assert.equal(after?.editing, "map.width");
  });
});
