// Import Node.js Dependencies
import {
  createServer,
  type Server
} from "node:http";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NetworkServer } from "#src/NetworkServer.ts";
import { NetworkPlugin } from "#src/NetworkPlugin.ts";
import { NetworkClient } from "#src/NetworkClient.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import type { ClientHandle } from "#src/types.ts";

class RecordingPlugin extends NetworkPlugin {
  readonly namespace = "test-ns";
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

describe("WebsocketTransport + NetworkClient (integration)", () => {
  let httpServer: Server;
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
    const server = new NetworkServer();
    const plugin = new RecordingPlugin();
    server.register(plugin);

    new WebsocketTransport({ httpServer, server });

    const client = new NetworkClient({ url: `ws://127.0.0.1:${port}/ws-sync` });
    const channel = client.channel("test-ns");

    await waitFor(() => plugin.connected.length === 1);

    let received: unknown;
    channel.onMessage = (payload) => {
      received = payload;
    };

    channel.send({ hello: "world" });
    await waitFor(() => plugin.messages.length === 1);
    assert.deepEqual(plugin.messages[0].payload, { hello: "world" });

    plugin.connected[0].send({ type: "ack" });
    await waitFor(() => received !== undefined);
    assert.deepEqual(received, { type: "ack" });

    channel.leave();
    await waitFor(() => plugin.disconnected.length === 1);

    client.destroy();
  });

  test("two real clients get peer-joined/peer-left over the wire", async() => {
    const server = new NetworkServer();
    const plugin = new RecordingPlugin();
    server.register(plugin);

    new WebsocketTransport({ httpServer, server, path: "/ws-sync-peers" });

    const clientA = new NetworkClient({ url: `ws://127.0.0.1:${port}/ws-sync-peers` });
    const channelA = clientA.channel("test-ns");
    const joined: string[] = [];
    channelA.onPeerJoined = (peerId) => joined.push(peerId);

    await waitFor(() => plugin.connected.length === 1);

    const clientB = new NetworkClient({ url: `ws://127.0.0.1:${port}/ws-sync-peers` });
    clientB.channel("test-ns");

    await waitFor(() => joined.length === 1);
    assert.deepEqual(joined, [plugin.connected[1].id]);

    const left: string[] = [];
    channelA.onPeerLeft = (peerId) => left.push(peerId);
    clientB.destroy();

    await waitFor(() => plugin.disconnected.length === 1);
    await waitFor(() => left.length === 1);
    assert.deepEqual(left, [plugin.connected[1].id]);

    clientA.destroy();
  });

  test("a namespace a client never joined never sees it", async() => {
    const server = new NetworkServer();
    const joined = new RecordingPlugin();
    class UnusedPlugin extends NetworkPlugin {
      readonly namespace = "unused";
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
    const unused = new UnusedPlugin();
    server.register(joined);
    server.register(unused);

    new WebsocketTransport({ httpServer, server, path: "/ws-sync-2" });

    const client = new NetworkClient({ url: `ws://127.0.0.1:${port}/ws-sync-2` });
    client.channel("test-ns");

    await waitFor(() => joined.connected.length === 1);
    assert.deepEqual(unused.connected, []);

    client.destroy();
  });
});
