// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Server,
  Client
} from "#src/index.ts";
import { ChannelTransport } from "#src/transport/channel/ChannelTransport.ts";
import { ChannelTransportHost } from "#src/transport/channel/ChannelTransportHost.ts";
import { DataChannelPort } from "#src/transport/channel/DataChannelPort.ts";
import { LoopbackTransport } from "#src/transport/loopback/LoopbackTransport.ts";
import {
  FakeDataChannel,
  fakeDataChannelPair
} from "../../helpers/transport/FakeDataChannel.ts";
import { RecordingExtension } from "../../helpers/server/RecordingExtension.ts";
import { waitFor } from "../../helpers/waitFor.ts";
import { assertBytesRoundTrip } from "../../helpers/transport/bytesRoundTrip.ts";

// CONSTANTS
const kChunkLength = 4_097;
const kUtf8 = new TextEncoder();

describe("DataChannelPort", () => {
  test("relays a session and a payload over 1 MB through bounded chunks", async() => {
    const server = new Server();
    const extension = new RecordingExtension("test-ns");
    server.register(extension);
    const loopback = new LoopbackTransport({ server });
    const [guestChannel, hostChannel] = fakeDataChannelPair();
    const host = new ChannelTransportHost({
      port: new DataChannelPort(hostChannel, { chunkLength: kChunkLength }),
      open: (request) => loopback.connect(request)
    });
    const transport = new ChannelTransport({
      port: new DataChannelPort(guestChannel, { chunkLength: kChunkLength }),
      host: host.id
    });
    const client = new Client({
      socket: () => transport.connect()
    });
    const room = client.room("test-ns");
    room.join();
    let received: unknown;
    room.on("message", (payload) => {
      received = payload;
    });
    const snapshot = "😀a".repeat(400_000);

    await waitFor(() => client.ready);
    room.send({ snapshot });
    await waitFor(() => extension.messages.length === 1, 10_000);
    extension.clients[0].send({ snapshot });
    await waitFor(() => received !== undefined, 10_000);

    assert.equal(
      (extension.messages[0].payload as { snapshot: string; }).snapshot,
      snapshot
    );
    assert.deepEqual(received, { snapshot });
    const longest = Math.max(
      ...[...guestChannel.sent, ...hostChannel.sent].map((chunk) => chunk.byteLength)
    );
    assert.ok(longest <= kChunkLength + 1);
    client.destroy();
    transport.close();
    host.close();
  });

  test("relays bytes in chunks of at most 16 KiB by default", async() => {
    const server = new Server();
    const extension = new RecordingExtension("test-ns");
    server.register(extension);
    const loopback = new LoopbackTransport({ server });
    const [guestChannel, hostChannel] = fakeDataChannelPair();
    const host = new ChannelTransportHost({
      port: new DataChannelPort(hostChannel),
      open: (request) => loopback.connect(request)
    });
    const transport = new ChannelTransport({
      port: new DataChannelPort(guestChannel),
      host: host.id
    });
    const client = new Client({
      socket: () => transport.connect()
    });

    await assertBytesRoundTrip(client, extension, 100_000);

    const chunks = [...guestChannel.sent, ...hostChannel.sent];
    assert.ok(chunks.length > 12);
    assert.ok(chunks.every((chunk) => chunk.byteLength <= 16_384 + 1));
    client.destroy();
    transport.close();
    host.close();
  });

  test("frames wait above the high-water mark until the channel drains", () => {
    const [local, remote] = fakeDataChannelPair({ autoDeliver: false });
    const sender = new DataChannelPort(local, {
      chunkLength: 50,
      highWaterMark: 100
    });
    const receiver = new DataChannelPort(remote);
    const received: unknown[] = [];
    receiver.addEventListener("message", (event) => received.push(event.data));
    receiver.start();
    const message = { text: "x".repeat(500) };

    sender.postMessage(message);
    const sentBeforeDrain = local.sent.length;
    while (local.inFlight.length > 0) {
      local.deliver(1);
    }

    assert.ok(sentBeforeDrain < local.sent.length);
    assert.ok(local.sent.length > 10);
    assert.deepEqual(received, [message]);
  });

  test("holds received messages until start()", () => {
    const [local, remote] = fakeDataChannelPair({ autoDeliver: false });
    const sender = new DataChannelPort(local);
    const receiver = new DataChannelPort(remote);
    const received: unknown[] = [];
    receiver.addEventListener("message", (event) => received.push(event.data));

    sender.postMessage({ type: "connect" });
    local.deliver();
    const beforeStart = [...received];
    receiver.start();

    assert.deepEqual(beforeStart, []);
    assert.deepEqual(received, [{ type: "connect" }]);
  });

  test("waits for a connecting channel to open before sending", () => {
    const channel = new FakeDataChannel({
      state: "connecting",
      autoDeliver: false
    });
    const port = new DataChannelPort(channel);

    port.postMessage({ type: "connect" });
    const sentWhileConnecting = channel.sent.length;
    channel.open();

    assert.equal(sentWhileConnecting, 0);
    assert.deepEqual(channel.sent, [
      Uint8Array.of(3, ...kUtf8.encode(JSON.stringify({ type: "connect" })))
    ]);
  });

  const kViolations: [string, unknown][] = [
    ["a string message", ".{}"],
    ["an empty chunk", new ArrayBuffer(0)],
    ["a chunk with unknown flags", Uint8Array.of(4, 0x7b, 0x7d).buffer],
    ["a message over maxMessageLength", new Uint8Array(12).buffer],
    ["a text chunk that is not UTF-8", Uint8Array.of(3, 0xff).buffer],
    ["a text chunk that is not JSON", Uint8Array.of(3, ...kUtf8.encode("{oops")).buffer],
    ["a binary chunk that is not a frame", Uint8Array.of(1, 1, 0).buffer]
  ];
  for (const [name, frame] of kViolations) {
    test(`closes the channel on ${name}`, () => {
      const channel = new FakeDataChannel({ autoDeliver: false });
      const port = new DataChannelPort(channel, { maxMessageLength: 10 });
      const received: unknown[] = [];
      port.addEventListener("message", (event) => received.push(event.data));
      port.start();

      channel.receive(frame);

      assert.equal(channel.readyState, "closed");
      assert.equal(port.closed, true);
      assert.deepEqual(received, []);
    });
  }

  test("drops messages posted after the far side closed", () => {
    const [local, remote] = fakeDataChannelPair({ autoDeliver: false });
    const port = new DataChannelPort(local);

    remote.close();
    port.postMessage({ type: "send" });

    assert.equal(port.closed, true);
    assert.deepEqual(local.sent, []);
  });
});
