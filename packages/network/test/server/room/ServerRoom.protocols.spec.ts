// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/server/identity.ts";
import {
  createClient,
  serverEnvelopeOf
} from "../../helpers/server/clientHandle.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/server/serverRoom.ts";
import {
  RightsTable,
  Server
} from "#src/index.ts";
import { syncProtocols } from "../../helpers/protocol/protocols.ts";

describe("ServerRoom — inbound protocol", () => {
  test("hands the extension a parsed message", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: identityOf("A") });

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages.map(({ payload }) => payload), [{ action: "voxel-set" }]);
  });

  test("answers a payload the protocol rejects with an \"error\" envelope", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: identityOf("A") });
    a.sent.length = 0;

    await room.message("A", { action: "not-a-known-action" });

    assert.deepEqual(extension.messages, []);
    assert.strictEqual(a.sent.length, 1);

    const sent = serverEnvelopeOf(a.sent[0]);
    assert.strictEqual(sent.room, "pixel-draw");
    assert.ok(sent.kind === "error");
    assert.strictEqual(sent.event, "$message");
    assert.notStrictEqual(sent.reason, "");
  });
});

describe("ServerRoom — outbound protocol", () => {
  test("keys the broadcast read gate on the command action, not on the envelope type", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      blocked: {
        "pixel-draw.$join": "write",
        "pixel-draw.voxel-set": "void"
      },
      allowed: {
        "pixel-draw.$join": "write",
        "pixel-draw.voxel-set": "read"
      }
    }));
    await room.join({ handle: a.client, identity: identityOf("A", "blocked") });
    await room.join({ handle: b.client, identity: identityOf("B", "allowed") });
    a.sent.length = 0;
    b.sent.length = 0;

    const payload = { type: "command", data: { action: "voxel-set" } };
    extension.lastContext.room.broadcast(payload);

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload
    }]);
  });

  test("gates a snapshot on the reserved \"$snapshot\" event", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      blocked: {
        "pixel-draw.$join": "write",
        "pixel-draw.$snapshot": "void"
      },
      allowed: {
        "pixel-draw.$join": "write",
        "pixel-draw.$snapshot": "read"
      }
    }));
    await room.join({ handle: a.client, identity: identityOf("A", "blocked") });
    await room.join({ handle: b.client, identity: identityOf("B", "allowed") });
    a.sent.length = 0;
    b.sent.length = 0;

    extension.lastContext.room.broadcast({ type: "snapshot", data: {} });

    assert.deepEqual(a.sent, []);
    assert.strictEqual(b.sent.length, 1);
  });

  test("drops a payload that does not match the outbound protocol", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: identityOf("A") });
    a.sent.length = 0;

    extension.lastContext.room.broadcast({ type: "command", data: { action: "unheard-of" } });

    assert.deepEqual(a.sent, []);
  });

  test("delivers a frozen payload sent again, gated per recipient", async() => {
    const extension = createExtension(syncProtocols);
    const serialized: string[] = [];
    const blocked = createClient("B");
    const room = createRoom(extension, new RightsTable({
      allowed: {
        "pixel-draw.$join": "write",
        "pixel-draw.voxel-set": "read"
      },
      blocked: {
        "pixel-draw.$join": "write",
        "pixel-draw.voxel-set": "void"
      }
    }));
    await room.join({
      handle: {
        id: "A",
        send: (data) => serialized.push(JSON.stringify(data)),
        sendSerialized: (json) => serialized.push(json)
      },
      identity: identityOf("A", "allowed")
    });
    await room.join({ handle: blocked.client, identity: identityOf("B", "blocked") });
    serialized.length = 0;
    blocked.sent.length = 0;

    const payload = Object.freeze({ type: "command", data: { action: "voxel-set" } });
    extension.lastContext.room.sendTo("A", payload);
    extension.lastContext.room.broadcast(payload);
    extension.lastContext.room.sendTo("B", payload);

    const expected = JSON.stringify({ room: "pixel-draw", kind: "message", payload });
    assert.deepEqual(serialized, [expected, expected]);
    assert.deepEqual(blocked.sent, []);
  });

  test("filters a scoped sendTo the same way as a broadcast", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({
      blocked: {
        "pixel-draw.$join": "write",
        "pixel-draw.voxel-set": "void"
      }
    }));
    await room.join({ handle: a.client, identity: identityOf("A", "blocked") });
    a.sent.length = 0;

    extension.lastContext.room.sendTo("A", {
      type: "command",
      data: { action: "voxel-set" }
    });

    assert.deepEqual(a.sent, []);
  });
});

describe("Server — outbound identified without validation", () => {
  async function joinedServer() {
    const server = new Server({
      validateOutbound: false,
      rights: {
        blocked: {
          "pixel-draw.$join": "write",
          "pixel-draw.voxel-set": "void"
        },
        allowed: {
          "pixel-draw.$join": "write",
          "pixel-draw.voxel-set": "read"
        }
      }
    });
    const extension = createExtension(syncProtocols);
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    await server.connect(a.client, identityOf("A", "blocked"))
      .receive({ room: "pixel-draw", kind: "join" });
    await server.connect(b.client, identityOf("B", "allowed"))
      .receive({ room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    return { extension, a, b };
  }

  test("gates a payload the protocol would reject on the event its tags name", async() => {
    const { extension, a, b } = await joinedServer();

    const payload = { type: "command", data: { action: "voxel-set" }, version: -1 };
    extension.lastContext.room.broadcast(payload);

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload
    }]);
  });

  test("drops a payload no tag identifies", async() => {
    const { extension, b } = await joinedServer();

    extension.lastContext.room.broadcast({ type: "command", data: { action: "unheard-of" } });
    extension.lastContext.room.broadcast({ data: { action: "voxel-set" } });

    assert.deepEqual(b.sent, []);
  });
});
