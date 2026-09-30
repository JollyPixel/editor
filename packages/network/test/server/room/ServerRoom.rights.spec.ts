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
  withoutSync
} from "../../helpers/clientHandle.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/serverRoom.ts";
import { RightsTable } from "#src/index.ts";
import { actionProtocols } from "../../helpers/protocols.ts";

describe("ServerRoom — rights: $join", () => {
  test("a role with \"write\" on $join is admitted", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "write" } }));

    const admitted = await room.join("A", a.client, identityOf("A", "viewer"), {});

    assert.strictEqual(admitted, true);
    assert.deepEqual(withoutSync(a.sent), []);
  });

  test("a role with \"void\" on $join is denied and never becomes a member", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    const admitted = await room.join("A", a.client, identityOf("A", "viewer"), {});

    assert.strictEqual(admitted, false);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    }]);
  });

  test("a role with \"read\" on $join collapses to denied, same as void", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "read" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A", "viewer"), {}), false);
  });

  test("a role absent from a configured rights table is denied", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A"), {}), false);
  });

  test("a glob pattern (\"pixel-draw.*\") matches the namespaced $join key", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.*": "void" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A", "viewer"), {}), false);
  });
});

describe("ServerRoom — rights: $presence", () => {
  test("a role with \"write\" on $presence can update presence", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "write" } }));
    await room.join("A", a.client, identityOf("A", "viewer"), {});
    await room.join("B", b.client, identityOf("B", "viewer"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 1, y: 1 } }
    }]);
  });

  test("a role with \"void\" on $presence is denied and its patch is not applied", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
    await room.join("A", a.client, identityOf("A", "viewer"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "$presence",
      reason: "role \"viewer\" cannot update presence"
    }]);
    assert.deepEqual(b.sent, []);
  });

  test("a role with \"void\" on $presence is filtered out of other members' presence broadcasts", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "void" } }));
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B", "viewer"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 1, y: 1 } });

    assert.deepEqual(b.sent, []);
  });

  test("a role with \"void\" on $presence joins without its presence and is denied", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      default: {},
      viewer: { "pixel-draw.$presence": "void" }
    }));
    await room.join("A", a.client, identityOf("A"), {});
    await room.join(
      "B",
      b.client,
      identityOf("B", "viewer"),
      {},
      { presence: { cursor: { x: 1, y: 1 } } }
    );

    assert.deepEqual(withoutSync(b.sent), [{
      room: "pixel-draw",
      kind: "denied",
      event: "$presence",
      reason: "role \"viewer\" cannot update presence"
    }]);
    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "viewer",
      profile: {},
      presence: {}
    }]);
  });

  test("a role with \"void\" on $presence receives peer-joined without presence", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      default: {},
      viewer: { "pixel-draw.$presence": "void" }
    }));
    await room.join("A", a.client, identityOf("A", "viewer"), {});
    await room.join(
      "B",
      b.client,
      identityOf("B"),
      {},
      { presence: { cursor: { x: 1, y: 1 } } }
    );

    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: {}
    }]);
  });
});

describe("ServerRoom — rights: message write gate", () => {
  test("a role with \"write\" on the event reaches the extension", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ editor: { "pixel-draw.voxel-set": "write" } }));
    await room.join("A", a.client, identityOf("A", "editor"), {});

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { action: "voxel-set" } }]);
  });

  test("a role with \"read\" on the event is denied and never reaches the extension", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.voxel-set": "read" } }));
    await room.join("A", a.client, identityOf("A", "viewer"), {});
    a.sent.length = 0;

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, []);
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test("a glob pattern (\"pixel-draw.*\") covers every event without listing each one", async() => {
    const extension = createExtension(actionProtocols);
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({
      viewer: {
        "pixel-draw.$join": "write",
        "pixel-draw.*": "read"
      }
    }));
    const admitted = await room.join("A", a.client, identityOf("A", "viewer"), {});

    await room.message("A", { action: "voxel-set" });
    await room.message("A", { action: "object-added" });

    assert.strictEqual(admitted, true);
    assert.deepEqual(extension.messages, []);
  });
});

describe("ServerRoom — rights: broadcast read gate", () => {
  test(`a role with "void" on the event is excluded from the broadcast; "read" still gets it`, async() => {
    const extension = createExtension(actionProtocols);
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

    extension.lastContext.room.broadcast({ action: "voxel-set" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    }]);
  });
});
