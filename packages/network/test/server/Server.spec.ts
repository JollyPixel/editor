// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { identityOf } from "../helpers/identity.ts";
import {
  Server,
  Extension,
  UngatedExtensionError,
  type ClientHandle,
  type MessageProtocols,
  type RoomContext
} from "#src/index.ts";
import {
  actionProtocols,
  OPAQUE_PROTOCOLS
} from "../helpers/protocols.ts";

class RecordingExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: MessageProtocols;
  connected: string[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];
  handles = new Map<string, ClientHandle>();
  context: RoomContext | undefined;

  constructor(
    id: string,
    name: string = id,
    protocols: MessageProtocols = OPAQUE_PROTOCOLS
  ) {
    super();
    this.id = id;
    this.name = name;
    this.protocols = protocols;
  }

  override onClientConnect(
    client: ClientHandle,
    _identity: unknown,
    context: RoomContext
  ): void {
    this.connected.push(client.id);
    this.handles.set(client.id, client);
    this.context = context;
  }

  override onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void {
    this.disconnected.push(clientId);
    this.context = context;
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.messages.push({ clientId, payload });
    this.context = context;
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

  test("scoped client.send() auto-tags outgoing payloads with the room", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client, identityOf(client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    extension.handles.get("A")?.send({ type: "snapshot" });

    assert.deepEqual(withoutSync(sent), [{
      room: "pixel-draw",
      kind: "message",
      payload: { type: "snapshot" }
    }]);
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
  test("notifies existing room members when a new client joins, but not the joiner itself", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(withoutSync(a.sent), []);

    await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: Object.create(null)
    }]);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "B",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "default",
          profile: Object.create(null),
          presence: {}
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

  test("notifies remaining members on explicit leave, but not the leaver", async() => {
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
    b.sent.length = 0;

    await server.handleMessage("B", { room: "pixel-draw", kind: "leave" });

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(b.sent, []);
  });

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
      profile: { username: "bob" }
    }]);
  });

  test("a joiner with no existing members still receives a sync envelope naming itself", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client, sent } = createClient("A");
    server.handleConnect(client, identityOf(client));

    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    assert.deepEqual(sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "default",
          profile: Object.create(null),
          presence: {}
        }
      ]
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

  test("presence updates merge into stored state and broadcast to other members, excluding the sender", async() => {
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
    b.sent.length = 0;

    await server.handleMessage("A", {
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 5, y: 5 } }
    });

    assert.deepEqual(a.sent, []);
    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: { x: 5, y: 5 } }
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

describe("Server — extension broadcast via RoomContext", () => {
  test(
    "onMessage receives a RoomContext whose room.broadcast reaches every member, envelope-wrapped like a scoped send",
    async() => {
      const server = new Server();
      const extension = new RecordingExtension("pixel-draw");
      server.register(extension);

      const a = createClient("A");
      const b = createClient("B");
      server.handleConnect(a.client, identityOf(a.client));
      server.handleConnect(b.client, identityOf(b.client));
      await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
      await server.handleMessage("B", { room: "pixel-draw", kind: "join" });
      await server.handleMessage("A", { room: "pixel-draw", kind: "message", payload: {} });
      a.sent.length = 0;
      b.sent.length = 0;

      extension.context?.room.broadcast({ hello: "world" });

      assert.deepEqual(a.sent, [{
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      }]);
      assert.deepEqual(b.sent, [{
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      }]);
    }
  );
});

describe("Server — rights: denied join", () => {
  test(
    "a client denied at join is not tracked as a room member, so later messages/presence never reach the extension",
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

  test("one rule covers every room registered under the same extension name, regardless of distinct ids", async() => {
    const server = new Server({
      rights: { viewer: { "voxel.renderer.voxel-set": "read" } }
    });
    const worldOne = new RecordingExtension("voxel-map:world-1", "voxel.renderer", actionProtocols);
    const worldTwo = new RecordingExtension("voxel-map:world-2", "voxel.renderer", actionProtocols);
    server.register(worldOne);
    server.register(worldTwo);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", { room: "voxel-map:world-1", kind: "join" });
    await server.handleMessage("B", { room: "voxel-map:world-2", kind: "join" });

    await server.handleMessage("A", { room: "voxel-map:world-1", kind: "message", payload: { action: "voxel-set" } });
    await server.handleMessage("B", { room: "voxel-map:world-2", kind: "message", payload: { action: "voxel-set" } });

    assert.deepEqual(worldOne.messages, []);
    assert.deepEqual(worldTwo.messages, []);
  });
});

describe("Server — event store", () => {
  test("defaults to an in-memory store shared by every registered room", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    server.handleConnect(a.client, identityOf(a.client));
    server.handleConnect(b.client, identityOf(b.client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });
    await server.handleMessage("B", { room: "voxel", kind: "join" });

    await pixel.context?.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    // Read back through the *other* room's context: same Server, one shared EventStore.
    assert.deepEqual(
      (await voxel.context?.eventStore.list("asset-1"))?.map((event) => event.eventData),
      [{ x: 1 }]
    );
  });

  test("uses the EventStore passed via ServerOptions instead of the default", async() => {
    const eventStore = EventStore.persistence.memory();
    const server = new Server({ eventStore });
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    server.handleConnect(client, identityOf(client));
    await server.handleMessage("A", { room: "pixel-draw", kind: "join" });

    await extension.context?.eventStore.append({
      assetType: "texture", assetId: "asset-1", eventType: "pixel-set", eventData: { x: 1 }
    });

    assert.deepEqual(
      eventStore.reader.list("asset-1").map((event) => event.eventData),
      [{ x: 1 }]
    );
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
