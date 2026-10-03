// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "#src/index.ts";
import {
  ChannelTransport,
  ChannelTransportHost,
  CHANNEL_TRANSPORT_TAG,
  isChannelTransportMessage
} from "#src/transport/channel.ts";
import {
  ManualChannel,
  type ManualPort
} from "../helpers/transport/ManualChannel.ts";

// CONSTANTS
const kHost = "host";
const kMaxDeliveries = 10_000;
const kRuns = 500;
const kSocketEvents: ClientSocketEventType[] = ["open", "message", "error", "close"];

type SocketListener = (event: ClientSocketEvent) => void;

type ChannelAction =
  | { type: "connect"; }
  | { type: "client-send"; socket: number; data: string; }
  | { type: "server-send"; socket: number; data: string; }
  | { type: "server-open"; socket: number; }
  | { type: "client-close"; socket: number; }
  | { type: "server-close"; socket: number; code: number; }
  | { type: "deliver"; port: number; }
  | { type: "noise"; port: number; message: unknown; }
  | { type: "transport-close"; }
  | { type: "host-close"; };

interface ChannelSetup {
  clientPorts: boolean;
  hostPorts: boolean;
}

class RelayedSocket implements ClientSocket {
  readonly received: string[] = [];
  readonly emitted: string[] = [];
  closed = false;

  #listeners = new Map<ClientSocketEventType, SocketListener[]>();

  send(
    data: string
  ): void {
    if (!this.closed) {
      this.received.push(data);
    }
  }

  close(): void {
    this.emit("close", { code: 1000 });
  }

  addEventListener(
    type: ClientSocketEventType,
    listener: SocketListener
  ): void {
    this.#listeners.set(type, [
      ...this.#listeners.get(type) ?? [],
      listener
    ]);
  }

  emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent = {}
  ): void {
    if (this.closed) {
      return;
    }
    if (type === "close") {
      this.closed = true;
    }
    if (type === "message") {
      this.emitted.push(String(event.data));
    }
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class ClientEnd {
  readonly id: string;
  readonly socket: ClientSocket;
  readonly sent: string[] = [];
  readonly received: string[] = [];
  readonly events: ClientSocketEventType[] = [];
  closing = false;

  constructor(
    id: string,
    socket: ClientSocket
  ) {
    this.id = id;
    this.socket = socket;
    for (const type of kSocketEvents) {
      socket.addEventListener(type, (event) => {
        this.events.push(type);
        if (type === "message") {
          this.received.push(String(event.data));
        }
      });
    }
  }

  get closed(): boolean {
    return this.events.includes("close");
  }

  send(
    data: string
  ): void {
    if (!this.closing && !this.closed) {
      this.sent.push(data);
    }
    this.socket.send(data);
  }

  close(): void {
    this.closing = true;
    this.socket.close();
  }
}

class ChannelHarness {
  readonly shared = new ManualChannel();
  readonly dedicated = new Map<string, ManualChannel>();
  readonly servers = new Map<string, RelayedSocket>();
  readonly clients: ClientEnd[] = [];
  readonly transport: ChannelTransport;
  readonly host: ChannelTransportHost;
  transportClosed = false;

  #connecting: string | null = null;
  #observer = (event: { data: unknown; }): void => {
    const message = event.data;
    if (isChannelTransportMessage(message) && message.type === "connect") {
      this.#connecting = message.socket;
    }
  };

  constructor(
    setup: ChannelSetup
  ) {
    this.shared.port1.addEventListener("message", this.#observer);
    this.host = new ChannelTransportHost({
      id: kHost,
      port: this.shared.port1,
      open: () => {
        const socket = new RelayedSocket();
        this.servers.set(this.#connecting!, socket);

        return socket;
      },
      socketPort: setup.hostPorts ? (id) => this.#channelOf(id).port1 : undefined
    });
    this.transport = new ChannelTransport({
      host: kHost,
      port: this.shared.port2,
      socketPort: setup.clientPorts ? (id) => this.#channelOf(id).port2 : undefined
    });
  }

  get ports(): ManualPort[] {
    return [
      ...this.shared.ports,
      ...[...this.dedicated.values()].flatMap((channel) => channel.ports)
    ];
  }

  apply(
    action: ChannelAction
  ): void {
    switch (action.type) {
      case "connect":
        this.#connect();
        break;
      case "client-send":
        this.#client(action.socket)?.send(action.data);
        break;
      case "server-send":
        this.#server(action.socket)?.emit("message", { data: action.data });
        break;
      case "server-open":
        this.#server(action.socket)?.emit("open");
        break;
      case "client-close":
        this.#client(action.socket)?.close();
        break;
      case "server-close":
        this.#server(action.socket)?.emit("close", { code: action.code });
        break;
      case "deliver": {
        const ports = this.#deliverable();
        ports[action.port % Math.max(ports.length, 1)]?.deliverNext();
        break;
      }
      case "noise":
        this.ports[action.port % this.ports.length].inject(action.message);
        break;
      case "transport-close":
        this.transportClosed = true;
        this.transport.close();
        break;
      default:
        this.host.close();
    }
  }

  async drain(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      for (let delivered = 0; delivered < kMaxDeliveries; delivered++) {
        const [port] = this.#deliverable();
        if (port === undefined) {
          break;
        }
        port.deliverNext();
      }
      await setImmediate();
    }
  }

  serverOf(
    client: ClientEnd
  ): RelayedSocket | undefined {
    return this.servers.get(client.id);
  }

  listeningPorts(): ManualPort[] {
    return this.ports.filter(
      (port) => [...port.listeners].some((listener) => listener !== this.#observer)
    );
  }

  #connect(): void {
    if (this.transportClosed) {
      return;
    }

    const socket = this.transport.connect();
    const connect = this.shared.port2.posted.at(-1);
    assert.ok(isChannelTransportMessage(connect));
    this.clients.push(new ClientEnd(connect.socket, socket));
  }

  #client(
    index: number
  ): ClientEnd | undefined {
    return this.clients[index % Math.max(this.clients.length, 1)];
  }

  #server(
    index: number
  ): RelayedSocket | undefined {
    const client = this.#client(index);

    return client === undefined ? undefined : this.serverOf(client);
  }

  #deliverable(): ManualPort[] {
    return this.ports.filter((port) => port.deliverable);
  }

  #channelOf(
    id: string
  ): ManualChannel {
    let channel = this.dedicated.get(id);
    if (channel === undefined) {
      channel = new ManualChannel();
      this.dedicated.set(id, channel);
    }

    return channel;
  }
}

function isPrefix(
  prefix: readonly string[],
  sequence: readonly string[]
): boolean {
  return prefix.length <= sequence.length &&
    prefix.every((value, index) => value === sequence[index]);
}

const kSocket = fc.nat({ max: 7 });
const kData = fc.string({ unit: "binary", maxLength: 6 });
const kNoise = fc.oneof(
  fc.anything(),
  fc.record({
    tag: fc.constant(CHANNEL_TRANSPORT_TAG),
    host: fc.constantFrom("other-host", kHost),
    socket: fc.constant("ghost"),
    type: fc.constantFrom("send", "close", "event"),
    event: fc.constantFrom(...kSocketEvents),
    data: fc.oneof(fc.string(), fc.constant({ data: "ghost" }))
  }),
  fc.record({
    tag: fc.constant(CHANNEL_TRANSPORT_TAG),
    host: fc.constant("other-host"),
    socket: fc.string({ maxLength: 4 }),
    type: fc.constant("connect"),
    dedicated: fc.boolean()
  })
);
const kAction: fc.Arbitrary<ChannelAction> = fc.oneof(
  { weight: 2, arbitrary: fc.constant({ type: "connect" as const }) },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constantFrom("client-send" as const, "server-send" as const),
      socket: kSocket,
      data: kData
    })
  },
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constantFrom("server-open" as const, "client-close" as const),
      socket: kSocket
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("server-close" as const),
      socket: kSocket,
      code: fc.integer({ min: 1000, max: 4999 })
    })
  },
  {
    weight: 8,
    arbitrary: fc.record({
      type: fc.constant("deliver" as const),
      port: fc.nat({ max: 7 })
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("noise" as const),
      port: fc.nat(),
      message: kNoise
    })
  },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      { type: "transport-close" as const },
      { type: "host-close" as const }
    )
  }
);
const kSetup = fc.record({
  clientPorts: fc.boolean(),
  hostPorts: fc.boolean()
});

describe("ChannelTransport + ChannelTransportHost properties", () => {
  test("sockets relay in order without loss or cross-talk, and both ends close together", async() => {
    await fc.assert(
      fc.asyncProperty(
        kSetup,
        fc.array(kAction, { maxLength: 40 }),
        async(setup, actions) => {
          const harness = new ChannelHarness(setup);
          for (const action of actions) {
            harness.apply(action);
          }
          await harness.drain();

          for (const client of harness.clients) {
            const server = harness.serverOf(client);
            const closeIndex = client.events.indexOf("close");
            assert.ok(closeIndex === -1 || closeIndex === client.events.length - 1);

            if (server === undefined) {
              assert.deepStrictEqual(client.received, []);
              continue;
            }

            assert.ok(isPrefix(server.received, client.sent));
            assert.ok(isPrefix(client.received, server.emitted));
            if (!client.closing && !client.closed && !server.closed) {
              assert.deepStrictEqual(server.received, client.sent);
              assert.deepStrictEqual(client.received, server.emitted);
            }
            assert.strictEqual(server.closed, client.closed || client.closing);
          }
        }
      ),
      { numRuns: kRuns }
    );
  });

  test("closing both ends releases every port listener and closes every socket", async() => {
    await fc.assert(
      fc.asyncProperty(
        kSetup,
        fc.array(kAction, { maxLength: 40 }),
        async(setup, actions) => {
          const harness = new ChannelHarness(setup);
          for (const action of actions) {
            harness.apply(action);
          }
          await harness.drain();
          harness.apply({ type: "transport-close" });
          harness.apply({ type: "host-close" });
          await harness.drain();

          assert.deepStrictEqual(harness.listeningPorts(), []);
          for (const client of harness.clients) {
            assert.ok(client.closed);
            assert.strictEqual(harness.serverOf(client)?.closed ?? true, true);
          }
        }
      ),
      { numRuns: kRuns }
    );
  });
});
