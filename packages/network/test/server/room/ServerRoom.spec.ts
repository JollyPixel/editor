// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/identity.ts";
import {
  ServerRoom
} from "#src/server/room/ServerRoom.ts";
import {
  Extension,
  RightsTable,
  type ClientHandle,
  type RoomContext
} from "#src/index.ts";
import {
  actionProtocols,
  OPAQUE_PROTOCOLS,
  syncProtocols
} from "../../helpers/protocols.ts";

class RecordingExtension extends Extension {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  readonly protocols = OPAQUE_PROTOCOLS;
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  contexts: RoomContext[] = [];

  override onClientConnect(
    client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.contexts.push(context);
  }

  override onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    this.disconnected.push(clientId);
    this.contexts.push(context);
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.contexts.push(context);
  }
}

class RightsAwareExtension extends Extension {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  readonly protocols = actionProtocols;
  messages: { clientId: string; payload: unknown; }[] = [];
  contexts: RoomContext[] = [];

  override onClientConnect(
    _client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.contexts.push(context);
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.contexts.push(context);
  }
}

function createClient(
  id: string
): { client: ClientHandle; sent: unknown[]; } {
  const sent: unknown[] = [];

  return {
    client: { id, send: (data) => sent.push(data) },
    sent
  };
}

function withoutSync(
  sent: unknown[]
): unknown[] {
  return sent.filter(
    (envelope) => (envelope as { kind?: string; }).kind !== "sync"
  );
}

function createRoom(
  extension: Extension,
  rights?: RightsTable
): ServerRoom {
  return new ServerRoom(extension.id, extension, rights);
}

describe("ServerRoom", () => {
  test("join notifies existing members but not the joiner itself", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);

    await room.join("A", a.client, identityOf("A"), {});
    assert.deepEqual(withoutSync(a.sent), []);

    await room.join("B", b.client, identityOf("B"), { username: "bob" });
    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: { username: "bob" }
    }]);
    assert.deepEqual(extension.connected, ["A", "B"]);
  });

  test("join always sends a sync snapshot naming the joiner and including it in the members", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);

    await room.join("A", a.client, identityOf("A"), { username: "alice" });
    assert.deepEqual(a.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "default",
          profile: { username: "alice" },
          presence: {}
        }
      ]
    }]);

    await room.join("B", b.client, identityOf("B"), {});
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "B",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "default",
          profile: { username: "alice" },
          presence: {}
        },
        {
          clientId: "B",
          role: "default",
          profile: {},
          presence: {}
        }
      ]
    }]);
  });

  test("scoped client passed to onClientConnect auto-tags send() with the room", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);

    await room.join("A", a.client, identityOf("A"), {});
    extension.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave broadcasts peer-left to members other than the leaver and notifies the extension", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    await room.leave("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
    assert.deepEqual(extension.disconnected, ["B"]);
  });

  test("updatePresence merges into state and broadcasts to members other than the sender", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    room.updatePresence("A", { cursor: { x: 5, y: 5 } });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
    }]);
  });

  test("updatePresence for an unknown member is a no-op", () => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("message forwards clientId and payload to the extension", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});

    await room.message("A", { hello: "world" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("room.broadcast reaches every current member, envelope-wrapped like a scoped send", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    extension.contexts.at(-1)!.room.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("room.broadcast is a no-op once every member has left", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.leave("A");
    const context = extension.contexts.at(-1)!;

    assert.doesNotThrow(() => context.room.broadcast({ hello: "world" }));
  });

  test("a message from a non-member never reaches the extension", async() => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);

    await room.message("nobody", { hello: "world" });

    assert.deepEqual(extension.messages, []);
  });
});

describe("ServerRoom — rights: $join", () => {
  test("a role with \"write\" on $join is admitted", async() => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "write" } }));

    const admitted = await room.join("A", a.client, identityOf("A", "viewer"), {});

    assert.strictEqual(admitted, true);
    assert.deepEqual(withoutSync(a.sent), []);
  });

  test("a role with \"void\" on $join is denied and never becomes a member", async() => {
    const extension = new RightsAwareExtension();
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
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "read" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A", "viewer"), {}), false);
  });

  test("a role absent from a configured rights table is denied", async() => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$join": "void" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A"), {}), false);
  });

  test("a glob pattern (\"pixel-draw.*\") matches the namespaced $join key", async() => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.*": "void" } }));

    assert.strictEqual(await room.join("A", a.client, identityOf("A", "viewer"), {}), false);
  });
});

describe("ServerRoom — rights: $presence", () => {
  test("a role with \"write\" on $presence can update presence", async() => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ viewer: { "pixel-draw.$presence": "write" } }));
    await room.join("A", a.client, identityOf("A", "viewer"), {});

    assert.doesNotThrow(() => room.updatePresence("A", { cursor: { x: 1, y: 1 } }));
  });

  test("a role with \"void\" on $presence is denied and its patch is not applied", async() => {
    const extension = new RightsAwareExtension();
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
    const extension = new RightsAwareExtension();
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
});

describe("ServerRoom — rights: message write gate", () => {
  test("a role with \"write\" on the event reaches the extension", async() => {
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({ editor: { "pixel-draw.voxel-set": "write" } }));
    await room.join("A", a.client, identityOf("A", "editor"), {});

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { action: "voxel-set" } }]);
  });

  test("a role with \"read\" on the event is denied and never reaches the extension", async() => {
    const extension = new RightsAwareExtension();
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
    const extension = new RightsAwareExtension();
    const a = createClient("A");
    /*
     * "pixel-draw.*" also matches "pixel-draw.$join" — list the more specific
     * rule first so join stays admitted (first match wins, see RightsTable).
     */
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
    const extension = new RightsAwareExtension();
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

    extension.contexts.at(-1)!.room.broadcast({ action: "voxel-set" });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    }]);
  });
});

describe("ServerRoom — RoomContext identity", () => {
  test("hands the member's authenticated identity to onClientConnect and onMessage", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    const identity = { subject: "alice", role: "editor" };
    await room.join("A", a.client, identity, {});
    await room.message("A", {});

    assert.deepEqual(
      extension.contexts.map((context) => context.identity),
      [identity, identity]
    );
  });

  test("keeps the departing member's identity for onClientDisconnect", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, { subject: "alice", role: "default" }, {});

    await room.leave("A");

    assert.deepEqual(extension.contexts.at(-1)!.identity, {
      subject: "alice",
      role: "default"
    });
  });

  test("scopes each context to the member that triggered it", async() => {
    const extension = new RecordingExtension();
    const room = createRoom(extension);
    await room.join("A", createClient("A").client, identityOf("A"), {});
    await room.join("B", createClient("B").client, identityOf("B"), {});

    await room.message("B", {});

    assert.deepEqual(extension.contexts.at(-1)!.identity, identityOf("B"));
  });

  test("ignores a leave from a client that is not a member", async() => {
    const extension = new RecordingExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    await room.leave("ghost");

    assert.deepEqual(extension.disconnected, []);
    assert.deepEqual(a.sent, []);
  });
});

class SyncExtension extends Extension {
  readonly id = "pixel-draw";
  readonly name = "pixel-draw";
  readonly protocols = syncProtocols;
  contexts: RoomContext[] = [];
  received: unknown[] = [];

  override onClientConnect(
    _client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.contexts.push(context);
  }

  override onMessage(
    _clientId: string,
    message: unknown,
    context: RoomContext
  ): void {
    this.received.push(message);
    this.contexts.push(context);
  }
}

describe("ServerRoom — inbound protocol", () => {
  test("hands the extension a parsed message", async() => {
    const extension = new SyncExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});

    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.received, [{ action: "voxel-set" }]);
  });

  test("answers a payload the protocol rejects with an \"error\" envelope", async() => {
    const extension = new SyncExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    await room.message("A", { action: "not-a-known-action" });

    assert.deepEqual(extension.received, []);
    assert.strictEqual(a.sent.length, 1);

    const sent = a.sent[0] as { room: string; kind: string; event: string; reason: string; };
    assert.strictEqual(sent.room, "pixel-draw");
    assert.strictEqual(sent.kind, "error");
    assert.strictEqual(sent.event, "$message");
    assert.notStrictEqual(sent.reason, "");
  });
});

describe("ServerRoom — outbound protocol", () => {
  test("keys the broadcast read gate on the command action, not on the envelope type", async() => {
    const extension = new SyncExtension();
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
    extension.contexts.at(-1)!.room.broadcast(payload);

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "message",
      payload
    }]);
  });

  test("gates a snapshot on the reserved \"$snapshot\" event", async() => {
    const extension = new SyncExtension();
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

    extension.contexts.at(-1)!.room.broadcast({ type: "snapshot", data: {} });

    assert.deepEqual(a.sent, []);
    assert.strictEqual(b.sent.length, 1);
  });

  test("drops a payload that does not match the outbound protocol", async() => {
    const extension = new SyncExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    extension.contexts.at(-1)!.room.broadcast({ type: "command", data: { action: "unheard-of" } });

    assert.deepEqual(a.sent, []);
  });

  test("filters a scoped sendTo the same way as a broadcast", async() => {
    const extension = new SyncExtension();
    const a = createClient("A");
    const room = createRoom(extension, new RightsTable({
      blocked: { "pixel-draw.voxel-set": "void" }
    }));
    await room.join("A", a.client, identityOf("A", "blocked"), {});
    a.sent.length = 0;

    extension.contexts.at(-1)!.room.sendTo("A", {
      type: "command",
      data: { action: "voxel-set" }
    });

    assert.deepEqual(a.sent, []);
  });
});

class HooklessExtension extends Extension {
  readonly id = "hookless";
  readonly name = "hookless";
  readonly protocols = OPAQUE_PROTOCOLS;
}

describe("ServerRoom — extension without lifecycle hooks", () => {
  test("join still admits the client and notifies existing members", async() => {
    const room = createRoom(new HooklessExtension());
    const a = createClient("A");
    const b = createClient("B");

    assert.equal(await room.join("A", a.client, identityOf("A"), {}), true);
    assert.equal(await room.join("B", b.client, identityOf("B"), { username: "bob" }), true);

    assert.deepEqual(withoutSync(a.sent), [{
      room: "hookless",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: { username: "bob" }
    }]);
  });

  test("leave still broadcasts peer-left to remaining members", async() => {
    const room = createRoom(new HooklessExtension());
    const a = createClient("A");
    const b = createClient("B");

    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;

    await room.leave("B");

    assert.deepEqual(a.sent, [{
      room: "hookless",
      kind: "peer-left",
      clientId: "B"
    }]);
  });

  test("message is dropped without reaching any client", async() => {
    const room = createRoom(new HooklessExtension());
    const a = createClient("A");

    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    await room.message("A", { any: "payload" });

    assert.deepEqual(a.sent, []);
  });
});
