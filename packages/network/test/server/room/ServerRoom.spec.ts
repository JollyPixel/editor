// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createIdentity } from "../../helpers/server/identity.ts";
import {
  createClient,
  toServerEnvelope,
  withoutSync
} from "../../helpers/server/clientConnection.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/server/serverRoom.ts";
import { ConnectedClient } from "#src/server/connection/ConnectedClient.ts";

describe("ServerRoom", () => {
  test("join notifies existing members but not the joiner itself", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);

    await room.join({ handle: a.client, identity: createIdentity("A") });
    assert.deepEqual(withoutSync(a.sent), []);

    await room.join({
      handle: b.client,
      identity: createIdentity("B"),
      profile: { username: "bob" }
    });
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

    await room.join({
      handle: a.client,
      identity: createIdentity("A"),
      profile: { username: "alice" }
    });
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

    await room.join({ handle: b.client, identity: createIdentity("B") });
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

    await room.join({ handle: a.client, identity: createIdentity("A") });
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
    await room.join({ handle: a.client, identity: createIdentity("A") });
    await room.join({ handle: b.client, identity: createIdentity("B") });
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
    await room.join({ handle: a.client, identity: createIdentity("A") });
    await room.join({ handle: b.client, identity: createIdentity("B") });
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
    await room.join({ handle: a.client, identity: createIdentity("A") });

    await room.message("A", { hello: "world" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { hello: "world" } }]);
  });

  test("room.broadcast reaches every current member, envelope-wrapped like a scoped send", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: createIdentity("A") });
    await room.join({ handle: b.client, identity: createIdentity("B") });
    a.sent.length = 0;
    b.sent.length = 0;

    extension.lastContext.room.broadcast({ hello: "world" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
    assert.deepEqual(b.sent, [{ room: "pixel-draw", kind: "message", payload: { hello: "world" } }]);
  });

  test("room.broadcast serializes once for every member", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const serialized: string[] = [];
    function serializingClient(
      id: string
    ) {
      return new ConnectedClient({
        id,
        sendSerialized: (json) => serialized.push(json),
        close: () => void 0
      });
    }
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: createIdentity("A") });
    await room.join({ handle: serializingClient("B"), identity: createIdentity("B") });
    await room.join({ handle: serializingClient("C"), identity: createIdentity("C") });
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
    assert.deepEqual(a.sent, [JSON.parse(expected)]);
  });

  test("join hands the resume payload to onClientConnect", async() => {
    const extension = createExtension();
    const room = createRoom(extension);

    await room.join({
      handle: createClient("A").client,
      identity: createIdentity("A"),
      resume: { version: 2 }
    });
    await room.join({ handle: createClient("B").client, identity: createIdentity("B") });

    assert.deepEqual(extension.peers.map((peer) => peer.resume), [{ version: 2 }, undefined]);
    assert.strictEqual("resume" in extension.peers[1], false);
  });

  test("resync forwards the member to the extension", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: createIdentity("A") });

    await room.resync("A");
    await room.resync("nobody");

    assert.deepEqual(extension.resynced, ["A"]);
    assert.strictEqual(extension.lastContext.identity.subject, createIdentity("A").subject);
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
    await room.join({ handle: a.client, identity: createIdentity("A") });
    await room.join({
      handle: b.client,
      identity: createIdentity("B"),
      presence: { cursor: { x: 2, y: 3 } }
    });
    await room.join({ handle: c.client, identity: createIdentity("C") });

    assert.deepEqual(withoutSync(a.sent)[0], {
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: { cursor: { x: 2, y: 3 } }
    });
    const sync = toServerEnvelope(c.sent[0]);
    assert.ok(sync.kind === "sync");
    assert.deepEqual(
      sync.members.find((member) => member.clientId === "B")?.presence,
      { cursor: { x: 2, y: 3 } }
    );
  });
});
