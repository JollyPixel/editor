// Import Internal Dependencies
import {
  Client,
  type ClientOptions,
  type ClientSocket,
  type ClientSocketEvent,
  type ClientSocketEventType
} from "#src/index.ts";

// CONSTANTS
const kNormalCloseCode = 1000;

type Listener = (event: ClientSocketEvent) => void;

export class FakeSocket implements ClientSocket {
  sent: string[] = [];
  #listeners = new Map<ClientSocketEventType, Listener[]>();

  addEventListener(
    type: ClientSocketEventType,
    handler: Listener
  ): void {
    const handlers = this.#listeners.get(type) ?? [];
    handlers.push(handler);
    this.#listeners.set(type, handlers);
  }

  send(
    data: string
  ): void {
    this.sent.push(data);
  }

  close(): void {
    this.serverClose({
      code: kNormalCloseCode,
      reason: ""
    });
  }

  open(): void {
    this.#emit("open", {});
  }

  receive(
    data: unknown
  ): void {
    this.deliver(JSON.stringify(data));
  }

  deliver(
    raw: string
  ): void {
    this.#emit("message", { data: raw });
  }

  serverClose(
    event: ClientSocketEvent
  ): void {
    this.#emit("close", event);
  }

  #emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent
  ): void {
    for (const handler of this.#listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

export function createClient(
  options: Omit<ClientOptions, "socket"> = {}
): { client: Client; socket: FakeSocket; } {
  const socket = new FakeSocket();
  const client = new Client({
    ...options,
    socket: () => socket
  });

  return { client, socket };
}

export function createReconnectingClient(
  options: Omit<ClientOptions, "socket"> = {}
): { client: Client; sockets: FakeSocket[]; } {
  const sockets: FakeSocket[] = [];
  const client = new Client({
    ...options,
    socket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);

      return socket;
    }
  });

  return { client, sockets };
}

export function createOpenClient(
  options: Omit<ClientOptions, "socket"> = {}
): { client: Client; socket: FakeSocket; } {
  const opened = createClient(options);
  opened.socket.open();

  return opened;
}
