// Import Node.js Dependencies
import { once } from "node:events";
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
import { WEBSOCKET_PROTOCOL } from "#src/transport/constants.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";

describe("WebsocketTransport + Client (integration)", () => {
  let httpServer: HttpServer;
  let port: number;

  before(async() => {
    httpServer = createServer();
    httpServer.listen(0);
    await once(httpServer, "listening");

    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }
    port = address.port;
  });

  after(() => {
    httpServer.close();
  });

  test("a revoked client reconnects and authenticates again", async() => {
    let role = "editor";
    const server = new Server({
      auth: {
        authenticate: () => {
          return {
            subject: "alice",
            role
          };
        }
      }
    });
    const extension = new RecordingExtension("test-ns");
    server.register(extension);
    new WebsocketTransport({ httpServer, server, path: "/ws-revoke" });

    const client = new Client({
      socket: () => connectWebSocket({ url: `ws://127.0.0.1:${port}/ws-revoke` }),
      reconnect: { delays: [0] }
    });
    client.room("test-ns").join();
    await waitFor(() => extension.connected.length === 1);

    role = "viewer";
    server.revoke("alice");

    await waitFor(() => extension.connected.length === 2);
    assert.deepEqual(
      extension.peers.map((peer) => peer.identity.role),
      ["editor", "viewer"]
    );

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
  const opened = Promise.withResolvers<Event>();
  socket.addEventListener("open", opened.resolve);
  socket.addEventListener("error", opened.reject);
  await opened.promise;
  const { extensions } = socket;
  socket.close();

  return extensions;
}
