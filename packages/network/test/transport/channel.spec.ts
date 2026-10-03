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
import {
  ChannelTransport,
  ChannelTransportHost,
  CHANNEL_TRANSPORT_TAG,
  isChannelTransportMessage,
  type ChannelPort
} from "#src/transport/channel.ts";
import { parseChannelTransportMessage } from "#src/transport/channel/protocol.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";

function createRelay(
  server = new Server()
) {
  const extension = new RecordingExtension("test-ns");
  server.register(extension);
  const channel = new MessageChannel();
  const loopback = new LoopbackTransport({ server });
  const host = new ChannelTransportHost({
    port: channel.port1,
    open: () => loopback.connect()
  });
  const transport = new ChannelTransport({
    port: channel.port2,
    host: host.id
  });

  return {
    extension,
    host,
    transport,
    [Symbol.dispose]: () => {
      transport.close();
      host.close();
      channel.port1.close();
      channel.port2.close();
    }
  };
}

function createSocketRelay(
  sides = {
    host: true,
    client: true
  }
) {
  const server = new Server();
  const extension = new RecordingExtension("test-ns");
  server.register(extension);
  const shared = new MessageChannel();
  const sharedTypes: unknown[] = [];
  for (const port of [shared.port1, shared.port2]) {
    port.addEventListener("message", (event) => {
      sharedTypes.push((event.data as { type: unknown; }).type);
    });
    port.start();
  }
  const socketChannels = new Map<string, MessageChannel>();
  const closedPorts: string[] = [];
  function socketPort(
    side: "port1" | "port2"
  ) {
    return (socket: string): ChannelPort => {
      let channel = socketChannels.get(socket);
      if (channel === undefined) {
        channel = new MessageChannel();
        socketChannels.set(socket, channel);
      }
      const port = channel[side];
      const close = port.close.bind(port);
      port.close = () => {
        closedPorts.push(side);
        close();
      };

      return port;
    };
  }
  const loopback = new LoopbackTransport({ server });
  const host = new ChannelTransportHost({
    port: shared.port1,
    open: () => loopback.connect(),
    socketPort: sides.host ? socketPort("port1") : undefined
  });
  const transport = new ChannelTransport({
    port: shared.port2,
    host: host.id,
    socketPort: sides.client ? socketPort("port2") : undefined
  });

  return {
    extension,
    host,
    transport,
    sharedTypes,
    closedPorts,
    [Symbol.dispose]: () => {
      transport.close();
      host.close();
      shared.port1.close();
      shared.port2.close();
      for (const channel of socketChannels.values()) {
        channel.port1.close();
        channel.port2.close();
      }
    }
  };
}

interface RecordingPort extends ChannelPort {
  posted: unknown[];
  deliver(data: unknown): void;
}

function recordingPort(): RecordingPort {
  const listeners = new Set<(event: { data: unknown; }) => void>();
  const posted: unknown[] = [];

  return {
    posted,
    postMessage: (message) => posted.push(message),
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    deliver: (data) => {
      for (const listener of listeners) {
        listener({ data });
      }
    }
  };
}

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
    const address = {
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      socket: "s1"
    };

    assert.strictEqual(isChannelTransportMessage({ ...address, type: "connect", dedicated: false }), true);
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "connect" }), false);
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "send", data: "x" }), true);
    assert.strictEqual(
      isChannelTransportMessage({ ...address, type: "event", event: "close", data: { code: 1000 } }),
      true
    );

    assert.strictEqual(isChannelTransportMessage({ tag: CHANNEL_TRANSPORT_TAG, type: "connect" }), false);
    assert.strictEqual(isChannelTransportMessage({ ...address, host: 1, type: "connect" }), false);
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "unknown" }), false);
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "send" }), false);
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "send", data: {} }), false);
    assert.strictEqual(
      isChannelTransportMessage({ ...address, type: "event", event: "unknown", data: {} }),
      false
    );
    assert.strictEqual(isChannelTransportMessage({ ...address, type: "event", event: "close" }), false);
    assert.strictEqual(
      isChannelTransportMessage({ ...address, type: "event", event: "close", data: { code: "1000" } }),
      false
    );
  });

  test("parsing keeps only the fields of the message shape", () => {
    const message = parseChannelTransportMessage({
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
    assert.strictEqual(parseChannelTransportMessage({ type: "connect" }), undefined);
  });

  test("a socket ignores events once it is closed", async() => {
    const port = recordingPort();
    const transport = new ChannelTransport({ port, host: "host-a" });
    const socket = transport.connect();
    const events: string[] = [];
    socket.addEventListener("message", () => events.push("message"));
    socket.addEventListener("close", () => events.push("close"));
    const [connect] = port.posted.filter(isChannelTransportMessage);
    function event(
      type: string
    ) {
      return {
        tag: CHANNEL_TRANSPORT_TAG,
        type: "event",
        host: "host-a",
        socket: connect.socket,
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
      port.posted.filter(isChannelTransportMessage).map((message) => message.type),
      ["connect", "close"]
    );
  });
});

describe("ChannelTransport + ChannelTransportHost with a port per socket", () => {
  test("relays a session while only the connect travels on the shared port", async() => {
    using relay = createSocketRelay();
    const client = new Client({
      socket: () => relay.transport.connect()
    });
    const room = client.room("test-ns");
    room.join();
    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });

    await waitFor(() => client.ready);
    room.send({ hello: "world" });
    await waitFor(() => relay.extension.messages.length === 1);
    relay.extension.clients[0].send({ type: "ack" });
    await waitFor(() => received !== undefined);

    assert.deepEqual(received, { type: "ack" });
    assert.deepEqual(relay.sharedTypes, ["connect"]);
    client.destroy();
  });

  test("closing a socket closes its port on both ends", async() => {
    using relay = createSocketRelay();
    const client = new Client({
      reconnect: false,
      socket: () => relay.transport.connect()
    });
    client.room("test-ns").join();
    await waitFor(() => relay.extension.connected.length === 1);

    client.destroy();

    await waitFor(() => relay.extension.disconnected.length === 1);
    await waitFor(() => relay.closedPorts.length === 2);
    assert.deepEqual(relay.closedPorts.toSorted(), ["port1", "port2"]);
  });

  test("the host closes the socket ports when it closes", async() => {
    using relay = createSocketRelay();
    new Client({
      reconnect: false,
      socket: () => relay.transport.connect()
    }).room("test-ns").join();
    await waitFor(() => relay.extension.connected.length === 1);

    relay.host.close();

    await waitFor(() => relay.extension.disconnected.length === 1);
    await waitFor(() => relay.closedPorts.length === 2);
    assert.deepEqual(relay.closedPorts, ["port1", "port2"]);
  });

  test("the host ignores sends on the shared port", () => {
    const port = recordingPort();
    const socketPort = recordingPort();
    const sent: string[] = [];
    const host = new ChannelTransportHost({
      port,
      id: "host-a",
      socketPort: () => socketPort,
      open: () => {
        const socket = new LoopbackTransport({ server: new Server() }).connect();
        socket.send = (data) => sent.push(data);

        return socket;
      }
    });
    const address = {
      tag: CHANNEL_TRANSPORT_TAG,
      host: "host-a",
      socket: "s1"
    };

    port.deliver({ ...address, type: "connect", dedicated: true });
    port.deliver({ ...address, type: "send", data: "shared" });
    socketPort.deliver({ ...address, type: "send", data: "dedicated" });
    socketPort.deliver({ ...address, socket: "s2", type: "send", data: "other" });

    assert.deepEqual(sent, ["dedicated"]);
    host.close();
  });

  test("a host with a factory serves a client without one on the shared port", async() => {
    using relay = createSocketRelay({ host: true, client: false });
    const client = new Client({
      socket: () => relay.transport.connect()
    });
    client.room("test-ns").join();

    await waitFor(() => relay.extension.connected.length === 1);

    assert.ok(relay.sharedTypes.includes("event"));
    assert.deepEqual(relay.closedPorts, []);
    client.destroy();
  });

  test("a host without a factory closes a socket that asks for its own port", async() => {
    using relay = createSocketRelay({ host: false, client: true });
    const socket = relay.transport.connect();
    const closed = new Promise<ClientSocketEvent>((resolve) => {
      socket.addEventListener("close", resolve);
    });

    assert.strictEqual((await closed).code, 1002);
    assert.deepEqual(relay.extension.connected, []);
    assert.deepEqual(relay.closedPorts, ["port2"]);
  });
});
