// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate as flush } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createIdentity } from "../../helpers/server/identity.ts";
import { toServerEnvelope } from "../../helpers/server/clientHandle.ts";
import {
  AssetExtension,
  client,
  harness,
  join
} from "../../helpers/server/dynamicRooms.ts";
import { actionProtocols } from "../../helpers/protocol/protocols.ts";
import {
  Server,
  type RoomResolution,
  type ServerEnvelope
} from "#src/index.ts";

describe("Server — dynamic room resolution", () => {
  test("a join creates the room once and a second joiner reuses it", async() => {
    const { server, created, extensions } = harness();

    await join(server, "A", "pixelart:asset-1");
    const first = extensions.get("pixelart:asset-1");
    await join(server, "B", "pixelart:asset-1");

    assert.deepEqual(created, ["pixelart:asset-1"]);
    assert.strictEqual(extensions.get("pixelart:asset-1"), first);
    await server.close();
  });

  test("concurrent joins resolve the room once", async() => {
    const { server, created } = harness();

    await Promise.all([
      join(server, "A", "pixelart:asset-1"),
      join(server, "B", "pixelart:asset-1")
    ]);

    assert.deepEqual(created, ["pixelart:asset-1"]);
    await server.close();
  });

  test("an unregistered kind is refused", async() => {
    const { server, created } = harness();

    await join(server, "A", "voxelmap:asset-1");

    assert.deepEqual(created, []);
    await server.close();
  });

  test("a name the resolver rejects is refused", async() => {
    const { server, created } = harness();

    await join(server, "A", "pixelart:");

    assert.deepEqual(created, []);
    await server.close();
  });

  test("a message to a never-joined dynamic room is dropped", async() => {
    const { server, created } = harness();

    const connectionA = server.connect(client("A"), createIdentity(client("A")));
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "message",
      payload: { hello: "world" }
    });

    assert.deepEqual(created, []);
    await server.close();
  });

  test("a resolver that throws drops the join and registers nothing", async() => {
    const kinds: string[] = [];
    const server = new Server();
    server.useRoomResolver(() => {
      throw new Error("resolver exploded");
    });

    const connectionA = server.connect(
      {
        id: "A",
        send: (data) => kinds.push(toServerEnvelope(data).kind)
      },
      createIdentity("A")
    );
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "join"
    });
    assert.strictEqual(kinds.length, 0);

    server.useRoomResolver((name): RoomResolution => {
      return { extension: new AssetExtension(name, "pixelart") };
    });
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "join"
    });

    assert.deepEqual(kinds, ["sync"]);
    await server.close();
  });

  test("a resolved room routes messages to its extension", async() => {
    const { server, extensions } = harness();

    const connectionA = await join(server, "A", "pixelart:asset-1");
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "message",
      payload: { stroke: 1 }
    });

    assert.deepEqual(
      extensions.get("pixelart:asset-1")?.messages,
      [{ stroke: 1 }]
    );
    await server.close();
  });
});

describe("dynamic rooms — read-only resolution", () => {
  test("members join with \"read\" message rights and their messages are denied", async() => {
    const envelopes: ServerEnvelope[] = [];
    const extension = new AssetExtension(
      "pixelart:asset-1",
      "pixelart",
      actionProtocols
    );
    const server = new Server();
    server.useRoomResolver((): RoomResolution => {
      return {
        extension,
        readOnly: true
      };
    });

    const connectionA = server.connect(
      {
        id: "A",
        send: (data) => envelopes.push(toServerEnvelope(data))
      },
      createIdentity("A")
    );
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "join"
    });
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "message",
      payload: { action: "voxel-set" }
    });

    const [sync, denied] = envelopes;
    assert.ok(sync.kind === "sync");
    assert.deepEqual(sync.rights, {
      $presence: "write",
      "voxel-set": "read",
      "object-added": "read"
    });
    assert.deepEqual(denied, {
      room: "pixelart:asset-1",
      kind: "denied",
      event: "voxel-set",
      reason: "role \"default\" cannot write \"voxel-set\""
    });
    assert.deepEqual(extension.messages, []);
    await server.close();
  });

  test("an extension without an inbound protocol is not resolved read-only", async() => {
    const kinds: string[] = [];
    const server = new Server();
    server.useRoomResolver((name): RoomResolution => {
      return {
        extension: new AssetExtension(name, "pixelart"),
        readOnly: true
      };
    });

    const connectionA = server.connect(
      {
        id: "A",
        send: (data) => kinds.push(toServerEnvelope(data).kind)
      },
      createIdentity("A")
    );
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "join"
    });

    assert.deepEqual(kinds, []);
    await server.close();
  });
});

describe("dynamic rooms — concurrent joins", () => {
  test("a slow resolution does not hold up a join on another room", async() => {
    const order: string[] = [];
    const gate = Promise.withResolvers<void>();
    const server = new Server();
    server.useRoomResolver(async(name): Promise<RoomResolution> => {
      if (name === "pixelart:slow") {
        await gate.promise;
      }
      order.push(name);

      return { extension: new AssetExtension(name, "pixelart") };
    });

    const connectionA = server.connect(client("A"), createIdentity(client("A")));
    const slow = connectionA.receive({
      room: "pixelart:slow",
      kind: "join"
    });
    await connectionA.receive({
      room: "pixelart:fast",
      kind: "join"
    });
    assert.deepEqual(order, ["pixelart:fast"]);

    gate.resolve();
    await slow;

    assert.deepEqual(order, ["pixelart:fast", "pixelart:slow"]);
    await server.close();
  });

  test("a message still lands after the join it followed on the same room", async() => {
    const { server, extensions } = harness();
    const room = "pixelart:a1";

    const connectionA = server.connect(client("A"), createIdentity(client("A")));
    const join = connectionA.receive({ room, kind: "join" });
    const message = connectionA.receive({
      room,
      kind: "message",
      payload: { action: "stroke" }
    });

    await Promise.all([join, message]);

    assert.deepEqual(
      extensions.get(room)?.messages,
      [{ action: "stroke" }]
    );
    await server.close();
  });

  test("a disconnect waits for the joins still in flight", async() => {
    const order: string[] = [];
    const gate = Promise.withResolvers<void>();
    const server = new Server();
    server.useRoomResolver(async(name): Promise<RoomResolution> => {
      await gate.promise;
      const extension = new AssetExtension(name, "pixelart");
      function connect() {
        order.push("join");
      }
      function disconnect() {
        order.push("leave");
      }

      return {
        extension: Object.assign(extension, {
          onClientConnect: connect,
          onClientDisconnect: disconnect
        })
      };
    });

    const connectionA = server.connect(client("A"), createIdentity(client("A")));
    const join = connectionA.receive({
      room: "pixelart:a1",
      kind: "join"
    });
    const disconnect = connectionA.close();
    await flush();
    assert.deepEqual(order, []);

    gate.resolve();
    await Promise.all([join, disconnect]);

    assert.deepEqual(order, ["join", "leave"]);
    await server.close();
  });
});
