// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/identity.ts";
import {
  createClient,
  serverEnvelopeOf
} from "../../helpers/clientHandle.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/serverRoom.ts";
import { RightsTable } from "#src/index.ts";
import { syncProtocols } from "../../helpers/protocols.ts";

describe("ServerRoom — inbound protocol", () => {
  test("hands the extension a parsed message", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages.map(({ payload }) => payload), [{ action: "voxel-set" }]);
  });

  test("answers a payload the protocol rejects with an \"error\" envelope", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
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
      blocked: { "pixel-draw.voxel-set": "void" },
      allowed: { "pixel-draw.voxel-set": "read" }
    }));
    await room.join("A", a.client, identityOf("A", "blocked"), {});
    await room.join("B", b.client, identityOf("B", "allowed"), {});
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
      blocked: { "pixel-draw.$snapshot": "void" },
      allowed: { "pixel-draw.$snapshot": "read" }
    }));
    await room.join("A", a.client, identityOf("A", "blocked"), {});
    await room.join("B", b.client, identityOf("B", "allowed"), {});
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
    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    extension.lastContext.room.broadcast({ type: "command", data: { action: "unheard-of" } });

    assert.deepEqual(a.sent, []);
  });

  test("filters a scoped sendTo the same way as a broadcast", async() => {
    const extension = createExtension(syncProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({
      blocked: { "pixel-draw.voxel-set": "void" }
    }));
    await room.join("A", a.client, identityOf("A", "blocked"), {});
    a.sent.length = 0;

    extension.lastContext.room.sendTo("A", {
      type: "command",
      data: { action: "voxel-set" }
    });

    assert.deepEqual(a.sent, []);
  });
});
