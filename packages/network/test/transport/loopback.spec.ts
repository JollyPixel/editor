// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  Client,
  type PeerIdentity
} from "#src/index.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import { RecordingExtension } from "../helpers/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";

function createLoopback(): {
  transport: LoopbackTransport;
  extension: RecordingExtension;
} {
  const server = new Server();
  const extension = new RecordingExtension("test-ns");
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
    assert.equal(room.clientId, extension.clients[0].id);

    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });

    room.send({ hello: "world" });
    await waitFor(() => extension.messages.length === 1);
    assert.deepEqual(extension.messages[0].payload, { hello: "world" });

    extension.clients[0].send({ type: "ack" });
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
    assert.deepEqual(joined, [extension.clients[1].id]);

    clientB.destroy();
    await waitFor(() => left.length === 1);
    assert.deepEqual(left, [extension.clients[1].id]);

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

  test("a socket closed before authentication settles never opens a session", async() => {
    const { promise, resolve } = Promise.withResolvers<PeerIdentity>();
    const server = new Server({
      auth: {
        authenticate: () => promise
      }
    });

    const socket = new LoopbackTransport({ server }).connect();
    const events: string[] = [];
    socket.addEventListener("open", () => events.push("open"));
    socket.addEventListener("close", (event) => events.push(`close:${event.code}`));

    socket.close();
    resolve({
      subject: "A",
      role: "default"
    });
    await setImmediate();

    assert.deepEqual(events, ["close:1000"]);
  });
});
