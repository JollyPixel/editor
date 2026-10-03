// Import Node.js Dependencies
import { once } from "node:events";
import { createServer } from "node:http";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  Server,
  Client,
  LoopbackTransport,
  ChannelTransport,
  ChannelTransportHost,
  connectWebSocket,
  type ClientSocket,
  type Room
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";
import {
  jsonPayload,
  wireCopy
} from "../helpers/arbitraries/json.ts";

// CONSTANTS
const kRooms = ["a", "b"];
const kLocalRuns = 100;
const kSocketRuns = 50;

interface TransportStack {
  name: string;
  runs: number;
  connect: () => ClientSocket;
}

type Delivery = [room: number, payload: unknown];

const kDelivery: fc.Arbitrary<Delivery> = fc.tuple(
  fc.nat({ max: kRooms.length - 1 }),
  fc.oneof(jsonPayload, fc.string({ unit: "binary", maxLength: 8 }))
);

function payloadsFor(
  deliveries: readonly Delivery[],
  room: number
): unknown[] {
  return deliveries
    .filter(([index]) => index === room)
    .map(([, payload]) => wireCopy(payload));
}

function payloadsFrom(
  extension: RecordingExtension,
  clientId: string | null
): unknown[] {
  return extension.messages
    .filter((message) => message.clientId === clientId)
    .map((message) => message.payload);
}

describe("transport parity properties", () => {
  const httpServer = createServer();
  const server = new Server();
  const extensions = kRooms.map((room) => new RecordingExtension(room));
  const stacks: TransportStack[] = [];
  const channel = new MessageChannel();

  before(async() => {
    for (const extension of extensions) {
      server.register(extension);
    }
    httpServer.listen(0);
    await once(httpServer, "listening");
    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }

    const loopback = new LoopbackTransport({ server });
    const host = new ChannelTransportHost({
      port: channel.port1,
      open: () => loopback.connect()
    });
    const transport = new ChannelTransport({
      port: channel.port2,
      host: host.id
    });
    new WebsocketTransport({ httpServer, server, path: "/plain" });
    new WebsocketTransport({
      httpServer,
      server,
      path: "/deflate",
      compression: { threshold: 0 }
    });
    const url = `ws://127.0.0.1:${address.port}`;

    stacks.push(
      {
        name: "loopback",
        runs: kLocalRuns,
        connect: () => loopback.connect()
      },
      {
        name: "channel",
        runs: kLocalRuns,
        connect: () => transport.connect()
      },
      {
        name: "websocket",
        runs: kSocketRuns,
        connect: () => connectWebSocket({ url: `${url}/plain` })
      },
      {
        name: "deflate websocket",
        runs: kSocketRuns,
        connect: () => connectWebSocket({ url: `${url}/deflate` })
      }
    );
  });

  after(async() => {
    channel.port1.close();
    channel.port2.close();
    httpServer.close();
    await server.close();
  });

  for (const name of ["loopback", "channel", "websocket", "deflate websocket"]) {
    test(`${name} delivers each room's payloads in order, both ways`, async() => {
      const stack = stacks.find((candidate) => candidate.name === name)!;

      await fc.assert(
        fc.asyncProperty(
          fc.array(kDelivery, { maxLength: 10 }),
          async(deliveries) => {
            const client = new Client({
              reconnect: false,
              socket: stack.connect
            });
            const received = kRooms.map(() => [] as unknown[]);
            const rooms: Room[] = kRooms.map((name, index) => {
              const room = client.room(name);
              room.on("message", (payload) => received[index].push(payload));
              room.join();

              return room;
            });

            try {
              await waitFor(() => rooms.every(
                (room, index) => extensions[index].connected.includes(room.clientId ?? "")
              ));
              const clientId = rooms[0].clientId;
              for (const [index, payload] of deliveries) {
                rooms[index].send(payload);
              }

              for (const [index, extension] of extensions.entries()) {
                const expected = payloadsFor(deliveries, index);
                await waitFor(() => payloadsFrom(extension, clientId).length === expected.length);
                assert.deepStrictEqual(payloadsFrom(extension, clientId), expected);

                const handle = extension.clients.find((candidate) => candidate.id === clientId)!;
                for (const [room, payload] of deliveries) {
                  if (room === index) {
                    handle.send(payload);
                  }
                }
                await waitFor(() => received[index].length === expected.length);
                assert.deepStrictEqual(received[index], expected);
              }
            }
            finally {
              client.destroy();
            }
          }
        ),
        { numRuns: stack.runs }
      );
    });
  }
});
