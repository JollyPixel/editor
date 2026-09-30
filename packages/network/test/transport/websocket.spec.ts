// Import Node.js Dependencies
import {
  createServer,
  type Server as HttpServer
} from "node:http";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  Client,
  connectWebSocket
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_PROTOCOL
} from "#src/transport/constants.ts";
import { RecordingExtension } from "../helpers/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";

describe("WebsocketTransport + Client (integration)", () => {
  let httpServer: HttpServer;
  let port: number;

  before(async() => {
    httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });

    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }
    port = address.port;
  });

  after(() => {
    httpServer.close();
  });

  test("joins, exchanges messages, and leaves over a real WebSocket", async() => {
    const server = new Server();
    const extension = new RecordingExtension("test-ns");
    server.register(extension);

    new WebsocketTransport({ httpServer, server, path: DEFAULT_WEBSOCKET_PATH });

    const client = new Client({
      socket: () => connectWebSocket({ url: `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}` })
    });
    const room = client.room("test-ns");
    room.join();

    assert.equal(room.clientId, null);

    await waitFor(() => extension.connected.length === 1);
    await waitFor(() => room.clientId !== null);
    assert.equal(room.clientId, extension.clients[0].id);

    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });

    room.send({ hello: "world" });
    await waitFor(() => extension.messages.length === 1);
    assert.deepEqual(extension.messages[0].payload, { hello: "world" });

    extension.clients[0].send({ type: "ack" });
    await waitFor(() => received !== undefined);
    assert.deepEqual(received, { type: "ack" });

    room.leave();
    await waitFor(() => extension.disconnected.length === 1);

    client.destroy();
  });

  test("two real clients get peer-joined/peer-left over the wire", async() => {
    const server = new Server();
    const extension = new RecordingExtension("test-ns");
    server.register(extension);

    new WebsocketTransport({ httpServer, server, path: "/ws-sync-peers" });

    const clientA = new Client({
      socket: () => connectWebSocket({ url: `ws://127.0.0.1:${port}/ws-sync-peers` })
    });
    const roomA = clientA.room("test-ns");
    roomA.join();
    const joined: string[] = [];
    roomA.on("peer-joined", (event) => joined.push(event.clientId));

    await waitFor(() => extension.connected.length === 1);

    const clientB = new Client({
      socket: () => connectWebSocket({ url: `ws://127.0.0.1:${port}/ws-sync-peers` })
    });
    clientB.room("test-ns").join();

    await waitFor(() => joined.length === 1);
    assert.deepEqual(joined, [extension.clients[1].id]);

    const left: string[] = [];
    roomA.on("peer-left", (event) => left.push(event.clientId));
    clientB.destroy();

    await waitFor(() => extension.disconnected.length === 1);
    await waitFor(() => left.length === 1);
    assert.deepEqual(left, [extension.clients[1].id]);

    clientA.destroy();
  });

  test("negotiates permessage-deflate only when compression is enabled", async() => {
    const server = new Server();
    server.register(new RecordingExtension("test-ns"));
    new WebsocketTransport({ httpServer, server, path: "/ws-plain" });
    new WebsocketTransport({ httpServer, server, path: "/ws-deflate", compression: true });

    assert.strictEqual(await negotiatedExtensions(port, "/ws-plain"), "");
    assert.match(await negotiatedExtensions(port, "/ws-deflate"), /^permessage-deflate/);
  });

  test("delivers a compressed room broadcast to every member", async() => {
    const server = new Server();
    const extension = new RecordingExtension("test-ns");
    server.register(extension);
    new WebsocketTransport({
      httpServer,
      server,
      path: "/ws-deflate-rooms",
      compression: { level: 1, threshold: 0 }
    });

    const clients = [0, 1].map(() => new Client({
      socket: () => connectWebSocket({
        url: `ws://127.0.0.1:${port}/ws-deflate-rooms`
      })
    }));
    const received: unknown[] = [];
    for (const client of clients) {
      const room = client.room("test-ns");
      room.on("message", (payload) => received.push(payload));
      room.join();
    }
    await waitFor(() => extension.connected.length === 2);

    const payload = { pixels: "A".repeat(64 * 1024) };
    extension.lastContext.room.broadcast(payload);
    await waitFor(() => received.length === 2);

    assert.deepEqual(received, [payload, payload]);
    for (const client of clients) {
      client.destroy();
    }
  });
});

async function negotiatedExtensions(
  port: number,
  path: string
): Promise<string> {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}${path}`,
    WEBSOCKET_PROTOCOL
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  const { extensions } = socket;
  socket.close();

  return extensions;
}
