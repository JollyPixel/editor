// Import Internal Dependencies
import { isNetworkEnvelope } from "./utils/envelope.ts";
import type {
  NetworkEnvelope,
  PeerMetadata
} from "./types.ts";
import type {
  NetworkChannel,
  NetworkPeer
} from "./NetworkChannel.ts";

export interface NetworkClientOptions {
  url: string;
  /**
   * Connection-wide static metadata (e.g. username), attached to every
   * "join" envelope this client sends. Set once for the lifetime of the
   * connection.
   */
  identity?: PeerMetadata;
}

/**
 * Browser/Node counterpart to NetworkServer.
 * Relies on the global `WebSocket` (available in both environments)
 */
export class NetworkClient {
  /**
   * Identifies this client across every channel it joins. Generated once per
   * connection so consumers don't each need to invent their own peer id.
   */
  readonly clientId: string = crypto.randomUUID();

  #identity: PeerMetadata;
  #socket: WebSocket;
  #ready = false;
  // Messages sent before the socket finishes opening are queued and flushed on `open`.
  #queue: string[] = [];
  #channels = new Map<string, NetworkChannel<any, any>>();

  constructor(
    options: NetworkClientOptions
  ) {
    this.#identity = options.identity ?? {};
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

    const peers = new Map<string, NetworkPeer>();

    const channel: NetworkChannel<ClientPayload, ServerPayload> = {
      namespace,
      localClientId: this.clientId,
      peers,
      onMessage: null,
      onPeerJoined: null,
      onPeerLeft: null,
      onPeerPresence: null,
      send: (payload) => this.#sendEnvelope({
        namespace,
        kind: "message",
        payload
      }),
      updatePresence: (patch) => this.#sendEnvelope({
        namespace,
        kind: "presence",
        patch
      }),
      leave: () => {
        this.#sendEnvelope({
          namespace,
          kind: "leave"
        });
        this.#channels.delete(namespace);
        peers.clear();
      }
    };

    this.#channels.set(namespace, channel);
    this.#sendEnvelope({
      namespace,
      kind: "join",
      identity: this.#identity
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
    // `channel.peers` is typed as a ReadonlyMap for consumers, but
    // NetworkClient owns the same underlying Map instance and is the only
    // place allowed to mutate it.
    const peers = channel.peers as Map<string, NetworkPeer>;

    switch (data.kind) {
      case "message":
        channel.onMessage?.(data.payload);
        break;
      case "sync":
        for (const member of data.members) {
          peers.set(member.clientId, {
            clientId: member.clientId,
            identity: member.identity,
            presence: member.presence
          });
        }
        break;
      case "peer-joined":
        peers.set(data.clientId, {
          clientId: data.clientId,
          identity: data.identity,
          presence: {}
        });
        channel.onPeerJoined?.(data.clientId);
        break;
      case "peer-left":
        peers.delete(data.clientId);
        channel.onPeerLeft?.(data.clientId);
        break;
      case "peer-presence": {
        const peer = peers.get(data.clientId);
        if (peer) {
          Object.assign(peer.presence, data.patch);
        }
        channel.onPeerPresence?.(data.clientId, data.patch);
        break;
      }
    }
  }
}
