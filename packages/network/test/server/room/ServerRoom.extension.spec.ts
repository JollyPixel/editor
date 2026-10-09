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
  withoutSync
} from "../../helpers/server/clientHandle.ts";
import {
  createExtension,
  createRoom
} from "../../helpers/server/serverRoom.ts";
import { Extension } from "#src/index.ts";
import { OPAQUE_PROTOCOLS } from "../../helpers/protocol/protocols.ts";

describe("ServerRoom — RoomContext identity", () => {
  test("hands the member's authenticated identity to onClientConnect and onMessage", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    const identity = { subject: "alice", role: "editor" };
    await room.join({ handle: a.client, identity });
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
    await room.join({ handle: a.client, identity: { subject: "alice", role: "default" } });

    await room.leave("A");

    assert.deepEqual(extension.lastContext.identity, {
      subject: "alice",
      role: "default"
    });
  });

  test("scopes each context to the member that triggered it", async() => {
    const extension = createExtension();
    const room = createRoom(extension);
    await room.join({ handle: createClient("A").client, identity: identityOf("A") });
    await room.join({ handle: createClient("B").client, identity: identityOf("B") });

    await room.message("B", {});

    assert.deepEqual(extension.lastContext.identity, identityOf("B"));
  });

  test("ignores a leave from a client that is not a member", async() => {
    const extension = createExtension();
    const a = createClient("A");
    const room = createRoom(extension);
    await room.join({ handle: a.client, identity: identityOf("A") });
    a.sent.length = 0;

    assert.equal(await room.leave("ghost"), false);
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

    assert.equal(await room.join({ handle: a.client, identity: identityOf("A") }), true);
    assert.equal(await room.join({
      handle: b.client,
      identity: identityOf("B"),
      profile: { username: "bob" }
    }), true);

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

    await room.join({ handle: a.client, identity: identityOf("A") });
    await room.join({ handle: b.client, identity: identityOf("B") });
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

    await room.join({ handle: a.client, identity: identityOf("A") });
    a.sent.length = 0;

    await room.message("A", { any: "payload" });

    assert.deepEqual(a.sent, []);
  });
});
