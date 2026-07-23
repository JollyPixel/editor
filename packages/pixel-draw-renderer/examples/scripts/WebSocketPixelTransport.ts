// Import Third-party Dependencies
import {
  NetworkClient,
  type NetworkChannel
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelTransport
} from "../../src/network/index.ts";

export interface WebSocketPixelTransportOptions {
  url: string;
  /**
   * Namespace of the `PixelSyncServer` instance backing this buffer.
   * @default "pixel-draw"
   */
  namespace?: string;
}

type ServerMessage =
  | { type: "snapshot"; data: PixelBufferSnapshot; }
  | { type: "command"; data: PixelNetworkCommand; };

/**
 * Browser-side `PixelTransport`, backed by a `NetworkClient` channel joined
 * under a single buffer's `PixelSyncServer` namespace.
 */
export class WebSocketPixelTransport implements PixelTransport {
  readonly localClientId = crypto.randomUUID();

  onCommand: ((command: PixelNetworkCommand) => void) | null = null;
  onSnapshot: ((snapshot: PixelBufferSnapshot) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  #client: NetworkClient;
  #channel: NetworkChannel<PixelNetworkCommand, ServerMessage>;

  constructor(
    options: WebSocketPixelTransportOptions
  ) {
    const { url, namespace = "pixel-draw" } = options;

    this.#client = new NetworkClient({ url });

    this.#channel = this.#client.channel<PixelNetworkCommand, ServerMessage>(
      namespace
    );
    this.#channel.onMessage = (payload) => {
      this.#handleMessage(payload);
    };
    this.#channel.onPeerJoined = (peerId) => {
      this.onPeerJoined?.(peerId);
    };
    this.#channel.onPeerLeft = (peerId) => {
      this.onPeerLeft?.(peerId);
    };
  }

  sendCommand(
    command: PixelNetworkCommand
  ): void {
    this.#channel.send(command);
  }

  destroy(): void {
    this.#channel.leave();
    this.#client.destroy();
  }

  #handleMessage(
    message: ServerMessage
  ): void {
    switch (message.type) {
      case "snapshot":
        this.onSnapshot?.(message.data);
        break;
      case "command":
        this.onCommand?.(message.data);
        break;
    }
  }
}
