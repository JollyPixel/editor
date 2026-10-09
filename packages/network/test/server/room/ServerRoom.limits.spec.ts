// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/server/identity.ts";
import {
  createClient,
  serverEnvelopeOf
} from "../../helpers/server/clientHandle.ts";
import { createExtension } from "../../helpers/server/serverRoom.ts";
import { actionProtocols } from "../../helpers/protocol/protocols.ts";
import { ServerRoom } from "#src/server/room/ServerRoom.ts";
import { RightsTable } from "#src/index.ts";

// CONSTANTS
const kPresenceVoidForViewer = {
  default: {
    "pixel-draw.*": "write"
  },
  viewer: {
    "pixel-draw.$presence": "void",
    "pixel-draw.*": "write"
  }
} as const;

function syncMembersOf(
  sent: unknown[]
): unknown[] {
  const sync = sent
    .map(serverEnvelopeOf)
    .find((envelope) => envelope.kind === "sync");
  if (sync === undefined || sync.kind !== "sync") {
    throw new Error("expected a sync envelope");
  }

  return sync.members;
}

describe("ServerRoom — sync snapshot presence", () => {
  test("a role with \"void\" on $presence gets the members without their presence", async() => {
    const extension = createExtension(actionProtocols);
    const room = new ServerRoom(extension.id, extension, new RightsTable(kPresenceVoidForViewer));
    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    await room.join({
      handle: a.client,
      identity: identityOf("A"),
      presence: { cursor: { x: 1, y: 1 } }
    });

    await room.join({ handle: b.client, identity: identityOf("B", "viewer") });
    await room.join({ handle: c.client, identity: identityOf("C") });

    assert.deepEqual(syncMembersOf(b.sent), [
      { clientId: "A", role: "default", profile: {}, presence: {} },
      { clientId: "B", role: "viewer", profile: {}, presence: {} }
    ]);
    assert.deepEqual(syncMembersOf(c.sent)[0], {
      clientId: "A",
      role: "default",
      profile: {},
      presence: { cursor: { x: 1, y: 1 } }
    });
  });
});

describe("ServerRoom — peer metadata length", () => {
  function roomWithLimit(): ServerRoom {
    const extension = createExtension(actionProtocols);

    return new ServerRoom(extension.id, extension, undefined, {
      limits: { peerMetadataLength: 64 }
    });
  }

  test("refuses a join whose profile is past the limit", async() => {
    const room = roomWithLimit();
    const a = createClient("A");

    const admitted = await room.join({
      handle: a.client,
      identity: identityOf("A"),
      profile: { username: "x".repeat(64) }
    });

    assert.strictEqual(admitted, false);
    assert.strictEqual(room.size, 0);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "error",
      event: "$join",
      reason: "profile exceeds 64 JSON characters"
    }]);
  });

  test("refuses a join whose initial presence is past the limit", async() => {
    const room = roomWithLimit();
    const a = createClient("A");

    const admitted = await room.join({
      handle: a.client,
      identity: identityOf("A"),
      presence: { selection: "x".repeat(64) }
    });

    assert.strictEqual(admitted, false);
    assert.strictEqual(room.size, 0);
  });

  test("drops a presence patch that grows the merged presence past the limit", async() => {
    const room = roomWithLimit();
    const a = createClient("A");
    const b = createClient("B");
    await room.join({ handle: a.client, identity: identityOf("A") });
    await room.join({ handle: b.client, identity: identityOf("B") });
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { first: "x".repeat(24) });
    room.updatePresence("A", { second: "x".repeat(24) });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "error",
      event: "$presence",
      reason: "presence exceeds 64 JSON characters"
    }]);
    assert.deepEqual(b.sent.map(serverEnvelopeOf), [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { first: "x".repeat(24) }
    }]);
  });

  test("measures a replaced key once, so repeated patches of one key never add up", async() => {
    const room = roomWithLimit();
    const a = createClient("A");
    await room.join({ handle: a.client, identity: identityOf("A") });
    a.sent.length = 0;

    for (let x = 0; x < 100; x++) {
      room.updatePresence("A", { cursor: "x".repeat(32) });
    }

    assert.deepEqual(a.sent, []);
  });
});

describe("ServerRoom — resync throttle", () => {
  test("runs the first resync at once and coalesces the next ones until the interval ends", async() => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
      const extension = createExtension(actionProtocols);
      const room = new ServerRoom(extension.id, extension, undefined, {
        limits: { resyncIntervalMs: 1_000 }
      });
      const a = createClient("A");
      await room.join({ handle: a.client, identity: identityOf("A") });

      await room.resync("A");
      await room.resync("A");
      await room.resync("A");
      assert.deepEqual(extension.resynced, ["A"]);

      mock.timers.tick(1_000);
      await Promise.resolve();
      assert.deepEqual(extension.resynced, ["A", "A"]);

      mock.timers.tick(5_000);
      await room.resync("A");
      assert.deepEqual(extension.resynced, ["A", "A", "A"]);
    }
    finally {
      mock.timers.reset();
    }
  });

  test("drops a deferred resync once the member left", async() => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
      const extension = createExtension(actionProtocols);
      const room = new ServerRoom(extension.id, extension);
      const a = createClient("A");
      await room.join({ handle: a.client, identity: identityOf("A") });

      await room.resync("A");
      await room.resync("A");
      await room.leave("A");
      mock.timers.tick(1_000);
      await Promise.resolve();

      assert.deepEqual(extension.resynced, ["A"]);
    }
    finally {
      mock.timers.reset();
    }
  });
});
