// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate as flush } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../../helpers/server/identity.ts";
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
import { actionProtocols } from "../../helpers/protocol/protocols.ts";

describe("Server — room eviction", () => {
  test("close disposes statically registered rooms too", async() => {
    const server = new Server();
    const extension = new AssetExtension("static-room", "static");
    server.register(extension);

    await server.close();

    assert.strictEqual(extension.disposed, 1);
  });
});

describe("Server — room lifetime regressions", () => {
  test("a stray envelope from a non-member does not keep an empty room alive", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, evicted } = harness({ graceMs: 1_000 });

    const connectionA = await join(server, "A", "pixelart:asset-1");
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "leave"
    });

    // dropped as "client has not joined room", and must not disarm the timer
    const connectionZ = server.connect(client("Z"), identityOf(client("Z")));
    await connectionZ.receive({
      room: "pixelart:asset-1",
      kind: "message",
      payload: {}
    });

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["pixelart:asset-1"]);
    await server.close();
  });

  test("a denied join leaves the room it resolved evictable", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const evicted: string[] = [];
    const server = new Server({
      roomGraceMs: 1_000,
      rights: {
        guest: { "kind.$join": "void" }
      }
    });
    server.setRoomResolver((name): RoomResolution => {
      return {
        extension: new AssetExtension(name, "kind", actionProtocols),
        onEvict: () => {
          evicted.push(name);
        }
      };
    });

    const connectionA = server.connect(client("A"), identityOf(client("A"), "guest"));
    await connectionA.receive({
      room: "kind:asset-1",
      kind: "join"
    });

    t.mock.timers.tick(1_000);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(evicted, ["kind:asset-1"]);
    await server.close();
  });

  test("outbound envelopes carry the joined name, not the extension id", async() => {
    const sent: any[] = [];
    const server = new Server();
    server.setRoomResolver((): RoomResolution => {
      return { extension: new AssetExtension("ext-id", "kind") };
    });

    const connectionA = server.connect({ id: "A", send: (data) => sent.push(data) }, identityOf("A"));
    const connectionB = server.connect({ id: "B", send: (data) => sent.push(data) }, identityOf("B"));
    await connectionA.receive({ room: "kind:asset-1", kind: "join" });
    await connectionB.receive({ room: "kind:asset-1", kind: "join" });

    assert.deepEqual(
      [...new Set(sent.map((envelope) => envelope.room))],
      ["kind:asset-1"]
    );
    await server.close();
  });

  test("a rejoin waits for the previous eviction to flush", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const order: string[] = [];
    const eviction = Promise.withResolvers<void>();
    const server = new Server({ roomGraceMs: 1_000 });
    server.setRoomResolver((name): RoomResolution => {
      order.push("resolve");

      return {
        extension: new AssetExtension(name, "kind"),
        /*
         * one-shot gate: only the first eviction blocks, so close() below
         * is not left waiting on a promise nothing resolves
         */
        onEvict: (): Promise<void> => {
          if (order.includes("evict:start")) {
            return Promise.resolve();
          }
          order.push("evict:start");

          return eviction.promise.then(() => {
            order.push("evict:end");
          });
        }
      };
    });

    const connectionA = await join(server, "A", "pixelart:asset-1");
    await connectionA.receive({
      room: "pixelart:asset-1",
      kind: "leave"
    });

    t.mock.timers.tick(1_000);
    await flush();
    assert.deepEqual(order, ["resolve", "evict:start"]);

    const connectionB = server.connect(client("B"), identityOf(client("B")));
    const rejoin = connectionB.receive({
      room: "pixelart:asset-1",
      kind: "join"
    });
    await flush();
    // the resolver must not have run again while the flush is pending
    assert.deepEqual(order, ["resolve", "evict:start"]);

    eviction.resolve();
    await rejoin;

    assert.deepEqual(
      order,
      ["resolve", "evict:start", "evict:end", "resolve"]
    );

    t.mock.timers.reset();
    await server.close();
  });
});

describe("Server browser timers", () => {
  test("evicts an empty room with a numeric timer handle", async(t) => {
    const callbacks: (() => void)[] = [];
    t.mock.method(globalThis, "setTimeout", (callback: () => void) => {
      callbacks.push(callback);

      return callbacks.length;
    });
    t.mock.method(globalThis, "clearTimeout", () => void 0);
    const { server, evicted, extensions } = harness();

    try {
      const connectionA = await join(server, "A", "pixelart:asset-1");
      await connectionA.close();
      assert.equal(callbacks.length, 1);

      callbacks[0]();
      await server.settled();
      assert.deepEqual(evicted, ["pixelart:asset-1"]);
      assert.equal(extensions.get("pixelart:asset-1")?.disposed, 1);
    }
    finally {
      await server.close();
    }
  });
});
