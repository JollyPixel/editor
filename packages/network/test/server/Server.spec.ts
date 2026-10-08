// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/server/identity.ts";
import {
  createClient,
  withoutSync
} from "../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import {
  Server,
  UngatedExtensionError
} from "#src/index.ts";
import { actionProtocols } from "../helpers/protocol/protocols.ts";

describe("Server", () => {
  test("does not notify an extension until the client joins its room", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));
    assert.deepEqual(extension.connected, []);

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(extension.connected, ["A"]);
  });

  test("routes messages only to the joined extension", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    await server.handleMessage("A", {
      room: "voxel",
      kind: "message",
      payload: { should: "be dropped" }
    });

    assert.deepEqual(pixel.messages, [{ clientId: "A", payload: { hello: "world" } }]);
    assert.deepEqual(voxel.messages, []);
  });

  test("leave notifies the extension once and stops routing further messages", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(extension.disconnected, ["A"]);
    assert.deepEqual(extension.messages, []);
  });

  test("disconnect notifies only extensions the client had joined", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleDisconnect("A");

    assert.deepEqual(pixel.disconnected, ["A"]);
    assert.deepEqual(voxel.disconnected, []);
  });

  test("ignores malformed envelopes and unknown rooms", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));

    await assert.doesNotReject(async() => {
      await server.handleMessage("A", "not an envelope");
      await server.handleMessage("A", { room: "unknown", kind: "join" });
      await server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
    });
    assert.deepEqual(extension.connected, []);
    assert.deepEqual(extension.messages, []);
  });

  test("drops an envelope of a kind only the server originates", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "peer-left",
      clientId: "B"
    });

    assert.deepEqual(extension.messages, []);
  });
});

describe("Server — peer presence", () => {
  test("notifies remaining members when a client disconnects", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    await server.handleDisconnect("B");

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
  });

  test("does not leak peer events across rooms", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", { room: "voxel", kind: "join" });

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(withoutSync(a.sent), []);
  });
});

describe("Server — peer metadata", () => {
  test("peer-joined sent to existing members includes the joiner's profile and role", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    await server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
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
  });

  test("the identity profile overrides the fields a joiner claims and keeps the others", async() => {
    const server = new Server();
    server.register(new RecordingExtension("pixel-draw"));

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, {
      ...identityOf(b.client),
      profile: { username: "bob" }
    });
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    await server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
      profile: {
        username: "alice",
        color: "red"
      }
    });

    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {
        username: "bob",
        color: "red"
      },
      presence: {}
    }]);
  });

  test("a joiner with existing members receives a sync snapshot of their profile and presence", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      profile: { username: "alice" }
    });
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 2 } }
    });
    b.sent.length = 0;

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });

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
          presence: { cursor: { x: 1, y: 2 } }
        },
        {
          clientId: "B",
          role: "default",
          profile: Object.create(null),
          presence: {}
        }
      ]
    }]);
  });

  test("presence from a client that hasn't joined the room is dropped", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    b.sent.length = 0;

    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(b.sent, []);
  });

  test("identity and presence are gone from the sync snapshot after leave/disconnect", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    server.handleConnect(c.client, identityOf(c.client));
    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "join",
      profile: { username: "alice" }
    });
    await server.handleMessage("B", {
      room: "pixel-draw",
      kind: "join",
      profile: { username: "bob" }
    });
    await server.handleMessage("A", { room: "pixel-draw", kind: "leave" });
    await server.handleDisconnect("B");

    await server.handleMessage("C", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(c.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "C",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "C",
          role: "default",
          profile: Object.create(null),
          presence: {}
        }
      ]
    }]);
  });
});

describe("Server — rights: denied join", () => {
  test(
    "a client denied at join is not a room member, so later messages/presence never reach the extension",
    async() => {
      const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });
      const extension = new RecordingExtension("pixel-draw", "pixel-draw", actionProtocols);
      server.register(extension);

      const { client, sent } = createClient("A");
      server.handleConnect(client, identityOf(client, "viewer"));
      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "join"
      });

      assert.deepEqual(extension.connected, []);
      assert.deepEqual(sent, [{
        room: "pixel-draw",
        kind: "denied",
        event: "$join",
        reason: "role \"viewer\" is not permitted to join this room"
      }]);

      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      });
      await server.handleMessage("A", {
        room: "pixel-draw",
        kind: "presence",
        patch: { cursor: { x: 1, y: 1 } }
      });

      assert.deepEqual(extension.messages, []);
    }
  );

  test("ServerOptions.rights gates message writes end-to-end, independent of the extension", async() => {
    const server = new Server({
      rights: { viewer: { "pixel-draw.voxel-set": "read" } }
    });
    const extension = new RecordingExtension("pixel-draw", "pixel-draw", actionProtocols);
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client, identityOf(client, "viewer"));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    sent.length = 0;

    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    });

    assert.deepEqual(extension.messages, []);
    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"viewer\" cannot write \"voxel-set\""
    }]);
  });

  test(
    "one rule covers every room registered under the same extension name, regardless of distinct ids",
    async() => {
      const server = new Server({
        rights: { viewer: { "voxel.renderer.voxel-set": "read" } }
      });
      const worldOne = new RecordingExtension("voxel-map:world-1", "voxel.renderer", actionProtocols);
      const worldTwo = new RecordingExtension("voxel-map:world-2", "voxel.renderer", actionProtocols);
      server.register(worldOne);
      server.register(worldTwo);

      const a = createClient("A");
      const b = createClient("B");
      server.handleConnect(a.client, identityOf(a.client, "viewer"));
      server.handleConnect(b.client, identityOf(b.client, "viewer"));
      await server.handleMessage("A", { room: "voxel-map:world-1", kind: "join" });
      await server.handleMessage("B", { room: "voxel-map:world-2", kind: "join" });
      a.sent.length = 0;
      b.sent.length = 0;

      await server.handleMessage(
        "A",
        { room: "voxel-map:world-1", kind: "message", payload: { action: "voxel-set" } }
      );
      await server.handleMessage(
        "B",
        { room: "voxel-map:world-2", kind: "message", payload: { action: "voxel-set" } }
      );

      assert.deepEqual(worldOne.messages, []);
      assert.deepEqual(worldTwo.messages, []);
      for (const [room, sent] of [
        ["voxel-map:world-1", a.sent],
        ["voxel-map:world-2", b.sent]
      ] as const) {
        assert.deepEqual(sent, [{
          room,
          kind: "denied",
          event: "voxel-set",
          reason: "role \"viewer\" cannot write \"voxel-set\""
        }]);
      }
    }
  );
});

describe("Server — RoomContext identity", () => {
  test("hands extensions the identity the connection was admitted with", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, { subject: "alice", role: "default" });
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(extension.contexts.at(-1)?.identity, {
      subject: "alice",
      role: "default"
    });
  });
});

describe("Server — rights: extension gating contract", () => {
  test("refuses an extension with no inbound protocol when a rights table is configured", () => {
    const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });

    assert.throws(
      () => server.register(new RecordingExtension("pixel-draw")),
      UngatedExtensionError
    );
  });

  test("admits an extension with no inbound protocol when no rights table is configured", () => {
    const server = new Server();

    assert.doesNotThrow(
      () => server.register(new RecordingExtension("pixel-draw"))
    );
  });
});
