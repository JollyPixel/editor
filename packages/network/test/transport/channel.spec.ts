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
  type ClientHandle,
  type ClientSocketEvent
} from "#src/index.ts";
import {
  ChannelTransport,
  ChannelTransportHost,
  CHANNEL_TRANSPORT_TAG,
  isChannelTransportMessage,
  type ChannelPort
} from "#src/transport/channel.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import { OPAQUE_PROTOCOLS } from "../helpers/protocols.ts";

class RecordingExtension extends Extension {
  readonly protocols = OPAQUE_PROTOCOLS;
  readonly id = "test-ns";
  readonly name = "test-ns";
  connected: ClientHandle[] = [];
  disconnected: string[] = [];
  messages: unknown[] = [];

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
    _clientId: string,
    payload: unknown
  ): void {
    this.messages.push(payload);
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

function createRelay(
  server = new Server()
) {
  const extension = new RecordingExtension();
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
    assert.deepEqual(relay.extension.messages, [{ hello: "world" }]);

    relay.extension.connected[0].send({ type: "ack" });
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

    port.deliver({ type: "connect", host: "host-a", socket: "s1" });
    port.deliver({ tag: CHANNEL_TRANSPORT_TAG, type: "connect", host: "host-b", socket: "s1" });
    assert.strictEqual(opened, 0);

    port.deliver({ tag: CHANNEL_TRANSPORT_TAG, type: "connect", host: "host-a", socket: "s1" });
    assert.strictEqual(opened, 1);
    host.close();
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
