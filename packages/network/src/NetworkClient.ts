// Import Internal Dependencies
import { isNetworkEnvelope } from "./utils/envelope.ts";
import type { NetworkEnvelope } from "./types.ts";
import type { NetworkChannel } from "./NetworkChannel.ts";

export interface NetworkClientOptions {
  url: string;
}

/**
 * Browser/Node counterpart to NetworkServer.
 * Relies on the global `WebSocket` (available in both environments)
 */
export class NetworkClient {
  #socket: WebSocket;
  #ready = false;
  // Messages sent before the socket finishes opening are queued and flushed on `open`.
  #queue: string[] = [];
  #channels = new Map<string, NetworkChannel<any, any>>();

  constructor(
    options: NetworkClientOptions
  ) {
    this.#socket = new WebSocket(options.url);

    this.#socket.addEventListener("open", () => {
      this.#ready = true;
      for (const raw of this.#queue) {
        this.#socket.send(raw);
      }
      this.#queue = [];
    });
    this.#socket.addEventListener("message", (event) => {
      this.#handleMessage(event.data);
    });
  }

  channel<ClientPayload = unknown, ServerPayload = unknown>(
    namespace: string
  ): NetworkChannel<ClientPayload, ServerPayload> {
    const existing = this.#channels.get(namespace);
    if (existing) {
      return existing;
    }

    const channel: NetworkChannel<ClientPayload, ServerPayload> = {
      namespace,
      onMessage: null,
      onPeerJoined: null,
      onPeerLeft: null,
      send: (payload) => this.#sendEnvelope({
        namespace,
        kind: "message",
        payload
      }),
      leave: () => {
        this.#sendEnvelope({
          namespace,
          kind: "leave"
        });
        this.#channels.delete(namespace);
      }
    };

    this.#channels.set(namespace, channel);
    this.#sendEnvelope({
      namespace,
      kind: "join"
    });

    return channel;
  }

  destroy(): void {
    this.#socket.close();
  }

  #sendEnvelope(
    envelope: NetworkEnvelope
  ): void {
    const raw = JSON.stringify(envelope);
    if (this.#ready) {
      this.#socket.send(raw);
    }
    else {
      this.#queue.push(raw);
    }
  }

  #handleMessage(
    raw: string
  ): void {
    const data: unknown = JSON.parse(raw);
    if (!isNetworkEnvelope(data)) {
      return;
    }

    const channel = this.#channels.get(data.namespace);
    if (!channel) {
      return;
    }

    switch (data.kind) {
      case "message":
        channel.onMessage?.(data.payload);
        break;
      case "peer-joined":
        channel.onPeerJoined?.(data.clientId);
        break;
      case "peer-left":
        channel.onPeerLeft?.(data.clientId);
        break;
    }
  }
}
