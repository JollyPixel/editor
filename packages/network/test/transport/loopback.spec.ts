// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  Client,
  Extension,
  type ClientHandle
} from "#src/index.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import { OPAQUE_PROTOCOLS } from "../helpers/protocols.ts";

class RecordingExtension extends Extension {
  readonly protocols = OPAQUE_PROTOCOLS;
  readonly id = "test-ns";
  readonly name = "test-ns";
  connected: ClientHandle[] = [];
  disconnected: string[] = [];
  messages: { clientId: string; payload: unknown; }[] = [];

  override onClientConnect(
    client: ClientHandle
  ): void {
    this.connected.push(client);
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.disconnected.push(clientId);
  }

  override onMessage(
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
      setTimeout(resolve, 5);
    });
  }
}

function createLoopback(): {
  transport: LoopbackTransport;
  extension: RecordingExtension;
} {
  const server = new Server();
  const extension = new RecordingExtension();
  server.register(extension);

  return {
    transport: new LoopbackTransport({ server }),
    extension
  };
}

describe("LoopbackTransport + Client (integration)", () => {
  test("joins, exchanges messages, and leaves without a socket", async() => {
    const { transport, extension } = createLoopback();
    const client = new Client({
      socket: () => transport.connect()
    });
    const room = client.room("test-ns");
    room.join();

    assert.equal(client.ready, false);
    await waitFor(() => extension.connected.length === 1);
    assert.equal(client.ready, true);
    assert.equal(room.clientId, extension.connected[0].id);

    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });

    room.send({ hello: "world" });
    await waitFor(() => extension.messages.length === 1);
    assert.deepEqual(extension.messages[0].payload, { hello: "world" });

    extension.connected[0].send({ type: "ack" });
    assert.equal(received, undefined);
    await waitFor(() => received !== undefined);
    assert.deepEqual(received, { type: "ack" });

    room.leave();
    await waitFor(() => extension.disconnected.length === 1);

    client.destroy();
  });

  test("two loopback clients see each other join and leave", async() => {
    const { transport, extension } = createLoopback();

    const clientA = new Client({
      socket: () => transport.connect()
    });
    const roomA = clientA.room("test-ns");
    roomA.join();
    const joined: string[] = [];
    const left: string[] = [];
    roomA.on("peer-joined", (event) => joined.push(event.clientId));
    roomA.on("peer-left", (event) => left.push(event.clientId));
    await waitFor(() => extension.connected.length === 1);

    const clientB = new Client({
      socket: () => transport.connect()
    });
    clientB.room("test-ns").join();
    await waitFor(() => joined.length === 1);
    assert.deepEqual(joined, [extension.connected[1].id]);

    clientB.destroy();
    await waitFor(() => left.length === 1);
    assert.deepEqual(left, [extension.connected[1].id]);

    clientA.destroy();
  });

  test("a rejected connection closes as unauthorized", async() => {
    const server = new Server({
      auth: {
        authenticate: () => null
      }
    });
    const transport = new LoopbackTransport({ server });
    const client = new Client({
      socket: () => transport.connect()
    });

    let unauthorized = 0;
    client.on("unauthorized", () => {
      unauthorized++;
    });

    await waitFor(() => unauthorized === 1);
    assert.equal(client.ready, false);
  });
});
