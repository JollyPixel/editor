// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate as flush } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/server/identity.ts";
import { serverEnvelopeOf } from "../../helpers/server/clientHandle.ts";
import {
  AssetExtension,
  client,
  harness,
  join
} from "../../helpers/server/dynamicRooms.ts";
import {
  Server,
  type RoomResolution
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

    server.handleConnect(client("A"), identityOf(client("A")));
    await server.handleMessage("A", {
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
    server.setRoomResolver(() => {
      throw new Error("resolver exploded");
    });

    server.handleConnect(
      {
        id: "A",
        send: (data) => kinds.push(serverEnvelopeOf(data).kind)
      },
      identityOf("A")
    );
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "join"
    });
    assert.strictEqual(kinds.length, 0);

    server.setRoomResolver((name): RoomResolution => {
      return { extension: new AssetExtension(name, "pixelart") };
    });
    await server.handleMessage("A", {
      room: "pixelart:asset-1",
      kind: "join"
    });

    assert.deepEqual(kinds, ["sync"]);
    await server.close();
  });

  test("a resolved room routes messages to its extension", async() => {
    const { server, extensions } = harness();

    await join(server, "A", "pixelart:asset-1");
    await server.handleMessage("A", {
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

describe("dynamic rooms — concurrent joins", () => {
  test("a slow resolution does not hold up a join on another room", async() => {
    const order: string[] = [];
    const gate = Promise.withResolvers<void>();
    const server = new Server();
    server.setRoomResolver(async(name): Promise<RoomResolution> => {
      if (name === "pixelart:slow") {
        await gate.promise;
      }
      order.push(name);

      return { extension: new AssetExtension(name, "pixelart") };
    });

    server.handleConnect(client("A"), identityOf(client("A")));
    const slow = server.handleMessage("A", {
      room: "pixelart:slow",
      kind: "join"
    });
    await server.handleMessage("A", {
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

    server.handleConnect(client("A"), identityOf(client("A")));
    const join = server.handleMessage("A", { room, kind: "join" });
    const message = server.handleMessage("A", {
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
    server.setRoomResolver(async(name): Promise<RoomResolution> => {
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

    server.handleConnect(client("A"), identityOf(client("A")));
    const join = server.handleMessage("A", {
      room: "pixelart:a1",
      kind: "join"
    });
    const disconnect = server.handleDisconnect("A");
    await flush();
    assert.deepEqual(order, []);

    gate.resolve();
    await Promise.all([join, disconnect]);

    assert.deepEqual(order, ["join", "leave"]);
    await server.close();
  });
});
