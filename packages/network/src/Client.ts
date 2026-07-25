// Import Internal Dependencies
import { Envelope } from "./Envelope.ts";
import { DEFAULT_WEBSOCKET_PATH } from "./transport/constants.ts";
import type {
  Logger,
  Peer,
  PeerMetadata
} from "./types.ts";
import type {
  Room
} from "./Room.ts";

export interface ClientOptions {
  /**
   * @default `${wss|ws}://${location.host}${DEFAULT_WEBSOCKET_PATH}`
   */
  url?: string;
  /**
   * Static client metadata (e.g. username) attached to each "join" envelope.
   */
  identity?: PeerMetadata;
  /**
   * @default a `console`-backed logger
   */
  logger?: Logger;
}

function getDefaultUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${location.host}${DEFAULT_WEBSOCKET_PATH}`;
}

function createConsoleLogger(): Logger {
  return {
    debug: (...args) => console.debug(...args),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
  };
}

export class Client extends EventTarget {
  readonly id: string = crypto.randomUUID();

  #identity: PeerMetadata;
  #logger: Logger;
  #socket: WebSocket;
  #ready = false;
  // Set once the socket closes; lets #send() flag messages that will never flush.
  #closed = false;
  #destroyed = false;
  // Buffer outbound messages until the socket opens.
  #queue: string[] = [];
  #rooms = new Map<string, Room<any, any>>();

  constructor(
    options: ClientOptions
  ) {
    super();
    this.#identity = options.identity ?? {};
    this.#logger = options.logger ?? createConsoleLogger();
    this.#socket = new WebSocket(options.url ?? getDefaultUrl());

    this.#socket.addEventListener("open", () => {
      this.#ready = true;
      for (const raw of this.#queue) {
        this.#socket.send(raw);
      }
      this.#queue = [];
      this.dispatchEvent(new Event("ready"));
    });
    this.#socket.addEventListener("message", (event) => {
      this.#handleMessage(event.data);
    });
    this.#socket.addEventListener("error", () => {
      this.#logger.error("WebSocket connection error");
    });
    this.#socket.addEventListener("close", (event) => {
      this.#ready = false;
      this.#closed = true;
      if (!this.#destroyed) {
        this.#logger.warn(
          { code: event.code, reason: event.reason },
          "WebSocket closed unexpectedly"
        );
      }
    });
  }

  get ready(): boolean {
    return this.#ready;
  }

  room<ClientMessage = unknown, ServerMessage = unknown>(
    name: string
  ): Room<ClientMessage, ServerMessage> {
    const existing = this.#rooms.get(name);
    if (existing) {
      return existing;
    }

    const peers = new Map<string, Peer>();

    const room: Room<ClientMessage, ServerMessage> = {
      id: name,
      clientId: this.id,
      peers,
      onMessage: null,
      onPeerJoined: null,
      onPeerLeft: null,
      onPeerPresence: null,
      send: (payload) => this.#send({
        room: name,
        kind: "message",
        payload
      }),
      updatePresence: (patch) => this.#send({
        room: name,
        kind: "presence",
        patch
      }),
      leave: () => {
        this.#send({
          room: name,
          kind: "leave"
        });
        this.#rooms.delete(name);
        peers.clear();
      }
    };

    this.#rooms.set(name, room);
    this.#send({
      room: name,
      kind: "join",
      identity: this.#identity
    });

    return room;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#socket.close();
  }

  #send(
    envelope: Envelope
  ): void {
    const result = Envelope.stringify(envelope);
    if (!result.success) {
      this.#logger.error({ envelope, error: result.error }, "failed to serialize outgoing envelope");

      return;
    }
    const raw = result.data;

    if (this.#ready) {
      this.#socket.send(raw);
    }
    else {
      if (this.#closed) {
        this.#logger.warn({ envelope }, "queuing message on a closed socket; it will never be sent");
      }
      this.#queue.push(raw);
    }
  }

  #handleMessage(
    raw: string
  ): void {
    const result = Envelope.parse(raw);
    if (!result.success) {
      this.#logger.warn({ raw, error: result.error }, "dropped malformed envelope");

      return;
    }
    const envelope = result.data;

    const room = this.#rooms.get(envelope.room);
    if (!room) {
      this.#logger.warn({ room: envelope.room, kind: envelope.kind }, "dropped envelope for an unjoined room");

      return;
    }
    // `room.peers` is readonly to consumers; Client mutates the backing map.
    const peers = room.peers as Map<string, Peer>;

    switch (envelope.kind) {
      case "message":
        room.onMessage?.(envelope.payload);
        break;
      case "sync":
        for (const member of envelope.members) {
          peers.set(member.clientId, {
            clientId: member.clientId,
            identity: member.identity,
            presence: member.presence
          });
        }
        break;
      case "peer-joined":
        peers.set(envelope.clientId, {
          clientId: envelope.clientId,
          identity: envelope.identity,
          presence: {}
        });
        room.onPeerJoined?.(envelope.clientId);
        break;
      case "peer-left":
        peers.delete(envelope.clientId);
        room.onPeerLeft?.(envelope.clientId);
        break;
      case "peer-presence": {
        const peer = peers.get(envelope.clientId);
        if (peer) {
          Object.assign(peer.presence, envelope.patch);
        }
        room.onPeerPresence?.(envelope.clientId, envelope.patch);
        break;
      }
    }
  }
}
