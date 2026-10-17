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
  type ClientSocketEvent
} from "#src/index.ts";
import { ChannelTransport } from "#src/transport/channel/ChannelTransport.ts";
import { ChannelTransportHost } from "#src/transport/channel/ChannelTransportHost.ts";
import {
  CHANNEL_TRANSPORT_TAG,
  parseChannelMessage
} from "#src/transport/channel/ChannelMessage.ts";
import { LoopbackTransport } from "#src/transport/loopback/LoopbackTransport.ts";
import {
  createRelay,
  recordingPort
} from "../../helpers/transport/channelRelay.ts";
import { waitFor } from "../../helpers/waitFor.ts";

describe("ChannelTransport + ChannelTransportHost", () => {
  test("relays a client session across a message port", async() => {
    using relay = createRelay();
    const client = new Client({
      socket: () => relay.transport.connect()
    });
    const room = client.room("test-ns");
    room.join();
    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });

    await waitFor(() => relay.extension.connected.length === 1);
    await waitFor(() => client.ready);
    room.send({ hello: "world" });
    await waitFor(() => relay.extension.messages.length === 1);
    assert.deepEqual(
      relay.extension.messages.map(({ payload }) => payload),
      [{ hello: "world" }]
    );

    relay.extension.clients[0].send({ type: "ack" });
    await waitFor(() => received !== undefined);
    assert.deepEqual(received, { type: "ack" });

    client.destroy();
    await waitFor(() => relay.extension.disconnected.length === 1);
  });

  test("relays an unauthorized close to the client", async() => {
    using relay = createRelay(new Server({
      auth: {
        authenticate: () => null
      }
    }));
    const client = new Client({
      socket: () => relay.transport.connect()
    });
    let unauthorized = false;
    client.on("unauthorized", () => {
      unauthorized = true;
    });

    await waitFor(() => unauthorized);
  });

  test("a transport credential reaches the server's authentication provider", async() => {
    const received: (string | null)[] = [];
    const server = new Server({
      auth: {
        authenticate: (attempt) => {
          received.push(attempt.credential ?? null);

          return {
            subject: attempt.clientId,
            role: attempt.defaultRole
          };
        }
      }
    });
    const loopback = new LoopbackTransport({ server });
    const channel = new MessageChannel();
    const host = new ChannelTransportHost({
      port: channel.port1,
      open: (request) => loopback.connect(request)
    });
    const clients = [
      new ChannelTransport({ port: channel.port2, host: host.id, credential: "invite" }),
      new ChannelTransport({ port: channel.port2, host: host.id })
    ].map((transport) => new Client({
      socket: () => transport.connect()
    }));
    for (const client of clients) {
      client.room("test-ns").join();
    }

    await waitFor(() => received.length === 2);

    assert.deepEqual(received.toSorted(), ["invite", null]);
    for (const client of clients) {
      client.destroy();
    }
    host.close();
    channel.port1.close();
    channel.port2.close();
  });

  test("close() ends open sockets with its event and disconnects them", async() => {
    using relay = createRelay();
    const closed: ClientSocketEvent[] = [];
    const client = new Client({
      reconnect: false,
      socket: () => {
        const socket = relay.transport.connect();
        socket.addEventListener("close", (event) => closed.push(event));

        return socket;
      }
    });
    client.room("test-ns").join();
    await waitFor(() => relay.extension.connected.length === 1);

    relay.transport.close({ code: 1001, reason: "gone" });

    await waitFor(() => closed.length === 1);
    assert.deepEqual(closed, [{ code: 1001, reason: "gone" }]);
    await waitFor(() => relay.extension.disconnected.length === 1);
    assert.throws(() => relay.transport.connect(), /closed/);
  });

  test("the host closes relayed sockets when it closes", async() => {
    using relay = createRelay();
    new Client({
      reconnect: false,
      socket: () => relay.transport.connect()
    }).room("test-ns").join();
    await waitFor(() => relay.extension.connected.length === 1);

    relay.host.close();

    await waitFor(() => relay.extension.disconnected.length === 1);
  });

  test("the host ignores untagged messages and other hosts", () => {
    const port = recordingPort();
    let opened = 0;
    const host = new ChannelTransportHost({
      port,
      id: "host-a",
      open: () => {
        opened++;

        return new LoopbackTransport({ server: new Server() }).connect();
      }
    });

    const connect = {
      type: "connect",
      socket: "s1",
      dedicated: false
    };
    port.deliver({ ...connect, host: "host-a" });
    port.deliver({ ...connect, tag: CHANNEL_TRANSPORT_TAG, host: "host-b" });
    assert.strictEqual(opened, 0);

    port.deliver({ ...connect, tag: CHANNEL_TRANSPORT_TAG, host: "host-a" });
    assert.strictEqual(opened, 1);
    host.close();
  });

  test("tagged messages with a malformed shape are rejected", () => {
    function accepts(
      value: unknown
    ): boolean {
      return parseChannelMessage(value) !== undefined;
    }
    const address = {
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      socket: "s1"
    };

    assert.strictEqual(accepts({ ...address, type: "connect", dedicated: false }), true);
    assert.strictEqual(accepts({ ...address, type: "connect" }), false);
    assert.strictEqual(accepts({ ...address, type: "send", data: "x" }), true);
    assert.strictEqual(
      accepts({ ...address, type: "event", event: "close", data: { code: 1000 } }),
      true
    );

    assert.strictEqual(accepts({ tag: CHANNEL_TRANSPORT_TAG, type: "connect" }), false);
    assert.strictEqual(accepts({ ...address, host: 1, type: "connect" }), false);
    assert.strictEqual(accepts({ ...address, type: "unknown" }), false);
    assert.strictEqual(accepts({ ...address, type: "send" }), false);
    assert.strictEqual(accepts({ ...address, type: "send", data: {} }), false);
    assert.strictEqual(
      accepts({ ...address, type: "event", event: "unknown", data: {} }),
      false
    );
    assert.strictEqual(accepts({ ...address, type: "event", event: "close" }), false);
    assert.strictEqual(
      accepts({ ...address, type: "event", event: "close", data: { code: "1000" } }),
      false
    );
  });

  test("parsing keeps only the fields of the message shape", () => {
    const message = parseChannelMessage({
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      socket: "s1",
      type: "event",
      event: "message",
      data: { data: "payload", extra: true },
      extra: true
    });

    assert.deepEqual(message, {
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      socket: "s1",
      type: "event",
      event: "message",
      data: { data: "payload" }
    });
    assert.strictEqual(parseChannelMessage({ type: "connect" }), undefined);
  });

  test("a socket ignores events once it is closed", async() => {
    const port = recordingPort();
    const transport = new ChannelTransport({ port, host: "host-a" });
    const socket = transport.connect();
    const events: string[] = [];
    socket.addEventListener("message", () => events.push("message"));
    socket.addEventListener("close", () => events.push("close"));
    const connect = parseChannelMessage(port.posted[0]);
    assert.ok(connect !== undefined);
    const socketId = connect.socket;
    function event(
      type: string
    ) {
      return {
        tag: CHANNEL_TRANSPORT_TAG,
        type: "event",
        host: "host-a",
        socket: socketId,
        event: type,
        data: {}
      };
    }

    port.deliver(event("message"));
    socket.close();
    port.deliver(event("message"));
    await Promise.resolve();

    assert.deepEqual(events, ["message", "close"]);
    assert.deepEqual(
      port.posted.map((message) => parseChannelMessage(message)?.type),
      ["connect", "close"]
    );
  });
});
