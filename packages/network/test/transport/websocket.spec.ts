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
  RoomAuthority,
  type ClientHandle
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import {
  DEFAULT_WEBSOCKET_PATH
} from "#src/transport/constants.ts";

class RecordingAuthority extends RoomAuthority {
  readonly id = "test-ns";
  connected: ClientHandle[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];

  onClientConnect(
    client: ClientHandle
  ): void {
    this.connected.push(client);
  }

  onClientDisconnect(
    clientId: string
  ): void {
    this.disconnected.push(clientId);
  }

  onMessage(
    clientId: string,
    payload: unknown
  ): void {
    this.messages.push({ clientId, payload });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: timed out");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

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
    const authority = new RecordingAuthority();
    server.register(authority);

    new WebsocketTransport({ httpServer, server, path: DEFAULT_WEBSOCKET_PATH });

    const client = new Client({ url: `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}` });
    const room = client.room("test-ns");
    room.join();

    assert.equal(typeof client.id, "string");
    assert.ok(client.id.length > 0);
    assert.equal(room.clientId, client.id);

    await waitFor(() => authority.connected.length === 1);

    let received: unknown;
    room.addEventListener("message", (event) => {
      received = event.detail;
    });

    room.send({ hello: "world" });
    await waitFor(() => authority.messages.length === 1);
    assert.deepEqual(authority.messages[0].payload, { hello: "world" });

    authority.connected[0].send({ type: "ack" });
    await waitFor(() => received !== undefined);
    assert.deepEqual(received, { type: "ack" });

    room.leave();
    await waitFor(() => authority.disconnected.length === 1);

    client.destroy();
  });

  test("two real clients get peer-joined/peer-left over the wire", async() => {
    const server = new Server();
    const authority = new RecordingAuthority();
    server.register(authority);

    new WebsocketTransport({ httpServer, server, path: "/ws-sync-peers" });

    const clientA = new Client({ url: `ws://127.0.0.1:${port}/ws-sync-peers` });
    const roomA = clientA.room("test-ns");
    roomA.join();
    const joined: string[] = [];
    roomA.addEventListener("peer-joined", (event) => joined.push(event.detail.clientId));

    await waitFor(() => authority.connected.length === 1);

    const clientB = new Client({ url: `ws://127.0.0.1:${port}/ws-sync-peers` });
    clientB.room("test-ns").join();

    assert.notEqual(clientA.id, clientB.id);

    await waitFor(() => joined.length === 1);
    assert.deepEqual(joined, [authority.connected[1].id]);

    const left: string[] = [];
    roomA.addEventListener("peer-left", (event) => left.push(event.detail.clientId));
    clientB.destroy();

    await waitFor(() => authority.disconnected.length === 1);
    await waitFor(() => left.length === 1);
    assert.deepEqual(left, [authority.connected[1].id]);

    clientA.destroy();
  });

  test("a room a client never joined never sees it", async() => {
    const server = new Server();
    const joined = new RecordingAuthority();
    class UnusedAuthority extends RoomAuthority {
      readonly id = "unused";
      connected: ClientHandle[] = [];
      onClientConnect(client: ClientHandle): void {
        this.connected.push(client);
      }
      onClientDisconnect(): void {
        // unused in this test
      }
      onMessage(): void {
        // unused in this test
      }
    }
    const unused = new UnusedAuthority();
    server.register(joined);
    server.register(unused);

    new WebsocketTransport({ httpServer, server, path: "/ws-sync-2" });

    const client = new Client({ url: `ws://127.0.0.1:${port}/ws-sync-2` });
    client.room("test-ns").join();

    await waitFor(() => joined.connected.length === 1);
    assert.deepEqual(unused.connected, []);

    client.destroy();
  });
});
