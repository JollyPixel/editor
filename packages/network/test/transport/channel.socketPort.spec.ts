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
  ChannelTransportHost,
  CHANNEL_TRANSPORT_TAG
} from "#src/transport/channel.ts";
import { LoopbackTransport } from "#src/transport/loopback.ts";
import {
  createSocketRelay,
  recordingPort
} from "../helpers/transport/channelRelay.ts";
import { waitFor } from "../helpers/waitFor.ts";

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
