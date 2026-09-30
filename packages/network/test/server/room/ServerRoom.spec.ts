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
  serverEnvelopeOf,
  withoutSync
} from "../../helpers/clientHandle.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/serverRoom.ts";
import { Extension } from "#src/index.ts";
import { OPAQUE_PROTOCOLS } from "../../helpers/protocols.ts";

describe("ServerRoom", () => {
  test("join notifies existing members but not the joiner itself", async() => {
    const extension = createExtension();
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
      profile: { username: "bob" },
      presence: {}
    }]);
    assert.deepEqual(extension.connected, ["A", "B"]);
  });

  test("join always sends a sync snapshot naming the joiner and including it in the members", async() => {
    const extension = createExtension();
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
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);

    await room.join("A", a.client, identityOf("A"), {});
    extension.clients[0].send({ type: "snapshot" });

    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
  });

  test("leave broadcasts peer-left to members other than the leaver and notifies the extension", async() => {
    const extension = createExtension();
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
    const extension = createExtension();
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

  test("message forwards clientId and payload to the extension", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});

    await room.message("A", { hello: "world" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("room.broadcast reaches every current member, envelope-wrapped like a scoped send", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", b.client, identityOf("B"), {});
    a.sent.length = 0;
    b.sent.length = 0;

    extension.lastContext.room.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("room.broadcast serializes once for members that accept serialized JSON", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const serialized: string[] = [];
    function serializingClient(
      id: string
    ) {
      return {
        id,
        send: () => void 0,
        sendSerialized: (json: string) => serialized.push(json)
      };
    }
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join("B", serializingClient("B"), identityOf("B"), {});
    await room.join("C", serializingClient("C"), identityOf("C"), {});
    a.sent.length = 0;
    serialized.length = 0;

    let serializations = 0;
    const payload = {
      toJSON() {
        serializations++;

        return { hello: "world" };
      }
    };
    extension.lastContext.room.broadcast(payload);

    const expected = "{\"room\":\"pixel-draw\",\"kind\":\"message\",\"payload\":{\"hello\":\"world\"}}";
    assert.strictEqual(serializations, 1);
    assert.deepEqual(serialized, [expected, expected]);
    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload }]);
  });

  test("a message from a non-member never reaches the extension", async() => {
    const extension = createExtension();
    const room = createRoom(extension);

    await room.message("nobody", { hello: "world" });

    assert.deepEqual(extension.messages, []);
  });

  test("join presence seeds the member for sync, peer-joined and the extension", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    await room.join(
      "B",
      b.client,
      identityOf("B"),
      {},
      { cursor: { x: 2, y: 3 } }
    );
    await room.join("C", c.client, identityOf("C"), {});

    assert.deepEqual(withoutSync(a.sent)[0], {
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: { cursor: { x: 2, y: 3 } }
    });
    const sync = serverEnvelopeOf(c.sent[0]);
    assert.ok(sync.kind === "sync");
    assert.deepEqual(
      sync.members.find((member) => member.clientId === "B")?.presence,
      { cursor: { x: 2, y: 3 } }
    );
  });
});

describe("ServerRoom — RoomContext identity", () => {
  test("hands the member's authenticated identity to onClientConnect and onMessage", async() => {
    const extension = createExtension();
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
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, { subject: "alice", role: "default" }, {});

    await room.leave("A");

    assert.deepEqual(extension.lastContext.identity, {
      subject: "alice",
      role: "default"
    });
  });

  test("scopes each context to the member that triggered it", async() => {
    const extension = createExtension();
    const room = createRoom(extension);
    await room.join("A", createClient("A").client, identityOf("A"), {});
    await room.join("B", createClient("B").client, identityOf("B"), {});

    await room.message("B", {});

    assert.deepEqual(extension.lastContext.identity, identityOf("B"));
  });

  test("ignores a leave from a client that is not a member", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join("A", a.client, identityOf("A"), {});
    a.sent.length = 0;

    await room.leave("ghost");

    assert.deepEqual(extension.disconnected, []);
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
      profile: { username: "bob" },
      presence: {}
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
