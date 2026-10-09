// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  ClientSocket,
  ClientSocketEvent,
  ClientSocketEventType
} from "#src/index.ts";
import {
  ChannelTransport,
  ChannelTransportHost,
  isChannelTransportMessage
} from "#src/transport/channel.ts";
import {
  ManualChannel,
  type ManualPort
} from "./ManualChannel.ts";

// CONSTANTS
export const HOST_ID = "host";
const kMaxDeliveries = 10_000;
export const SOCKET_EVENTS: ClientSocketEventType[] = ["open", "message", "error", "close"];

type SocketListener = (event: ClientSocketEvent) => void;

export type ChannelAction =
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

export interface ChannelSetup {
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
    for (const type of SOCKET_EVENTS) {
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

export class ChannelHarness {
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
      id: HOST_ID,
      port: this.shared.port1,
      open: () => {
        const socket = new RelayedSocket();
        this.servers.set(this.#connecting!, socket);

        return socket;
      },
      socketPort: setup.hostPorts ? (id) => this.#channelOf(id).port1 : undefined
    });
    this.transport = new ChannelTransport({
      host: HOST_ID,
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
