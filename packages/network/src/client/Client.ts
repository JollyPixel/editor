// Import Third-party Dependencies
import { match } from "ts-pattern";
import { Emitter } from "@openally/emitt";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { Envelope } from "../Envelope.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../transport/constants.ts";
import type {
  Peer,
  PeerMetadata
} from "../types.ts";
import type {
  Room,
  RoomEventMap
} from "./Room.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";

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

export type ClientEventMap = {
  ready: () => void;
};

// Client's own view of a room: same public surface as `Room`, plus the `emit` used to
// deliver incoming envelopes. `Room` deliberately omits `emit` so consumers can't fake events.
type InternalRoom<ClientMessage = any, ServerMessage = any> =
  Room<ClientMessage, ServerMessage> & Emitter<RoomEventMap<ServerMessage>>;

function getDefaultUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${location.host}${DEFAULT_WEBSOCKET_PATH}`;
}

export class Client extends Emitter<ClientEventMap> {
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
  #rooms = new Map<string, InternalRoom>();

  constructor(
    options: ClientOptions
  ) {
    super();
    this.#identity = options.identity ?? {};
    this.#logger = options.logger ?? createLogger();
    this.#socket = new WebSocket(
      options.url ?? getDefaultUrl()
    );

    this.#socket.addEventListener("open", () => {
      this.#ready = true;
      for (const raw of this.#queue) {
        this.#socket.send(raw);
      }
      this.#queue = [];
      this.emit("ready");
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
        this.#logger
          .withMetadata({ code: event.code, reason: event.reason })
          .warn("WebSocket closed unexpectedly");
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
    let joined = false;

    const room: InternalRoom<ClientMessage, ServerMessage> = Object.assign(
      new Emitter<RoomEventMap<ServerMessage>>(),
      {
        id: name,
        clientId: this.id,
        peers,
        join: () => {
          if (joined) {
            return;
          }
          joined = true;
          this.#send({
            room: name,
            kind: "join",
            identity: this.#identity
          });
        },
        send: (payload: ClientMessage) => this.#send({
          room: name,
          kind: "message",
          payload
        }),
        updatePresence: (patch: PeerMetadata) => this.#send({
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
      }
    );

    this.#rooms.set(name, room);

    return room;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#socket.close();
  }

  #send(
    envelope: Envelope
  ): void {
    Envelope.stringify(envelope)
      .orTee((error) => this.#logger
        .withMetadata({ envelope, error })
        .error("failed to serialize outgoing envelope"))
      .andTee((raw) => this.#dispatch(raw, envelope));
  }

  #dispatch(
    raw: string,
    envelope: Envelope
  ): void {
    if (this.#ready) {
      this.#socket.send(raw);

      return;
    }
    if (this.#closed) {
      this.#logger
        .withMetadata({ envelope })
        .warn("queuing message on a closed socket; it will never be sent");
    }
    this.#queue.push(raw);
  }

  #handleMessage(
    raw: string
  ): void {
    Envelope.parse(raw)
      .orTee((error) => this.#logger
        .withMetadata({ raw, error })
        .warn("dropped malformed envelope"))
      .andThen((envelope) => this.#roomFor(envelope))
      .andTee(([room, envelope]) => this.#dispatchEnvelope(room, envelope));
  }

  #roomFor(
    envelope: Envelope
  ): Result<[InternalRoom, Envelope], void> {
    const room = this.#rooms.get(envelope.room);
    const result: Result<[InternalRoom, Envelope], void> = room ?
      Ok([room, envelope]) :
      Err(undefined);

    return result.orTee(() => this.#logger
      .withMetadata({ room: envelope.room, kind: envelope.kind })
      .warn("dropped envelope for an unjoined room"));
  }

  #dispatchEnvelope(
    room: InternalRoom,
    envelope: Envelope
  ): void {
    // `room.peers` is readonly to consumers; Client mutates the backing map.
    const peers = room.peers as Map<string, Peer>;

    match(envelope)
      .with({ kind: "message" }, (envelope) => this.#handleRoomMessage(room, envelope))
      .with({ kind: "sync" }, (envelope) => this.#handleSync(peers, envelope))
      .with({ kind: "peer-joined" }, (envelope) => this.#handlePeerJoined(room, peers, envelope))
      .with({ kind: "peer-left" }, (envelope) => this.#handlePeerLeft(room, peers, envelope))
      .with({ kind: "peer-presence" }, (envelope) => this.#handlePeerPresence(room, peers, envelope))
      .with({ kind: "denied" }, (envelope) => this.#handleDenied(room, envelope))
      .with({ kind: "error" }, (envelope) => this.#handleError(room, envelope))
      .otherwise(() => void 0);
  }

  #handleRoomMessage(
    room: InternalRoom,
    envelope: Extract<Envelope, { kind: "message"; }>
  ): void {
    room.emit("message", envelope.payload);
  }

  #handleSync(
    peers: Map<string, Peer>,
    envelope: Extract<Envelope, { kind: "sync"; }>
  ): void {
    for (const member of envelope.members) {
      peers.set(member.clientId, {
        clientId: member.clientId,
        identity: member.identity,
        presence: member.presence
      });
    }
  }

  #handlePeerJoined(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<Envelope, { kind: "peer-joined"; }>
  ): void {
    peers.set(envelope.clientId, {
      clientId: envelope.clientId,
      identity: envelope.identity,
      presence: {}
    });

    room.emit("peer-joined", {
      clientId: envelope.clientId
    });
  }

  #handlePeerLeft(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<Envelope, { kind: "peer-left"; }>
  ): void {
    peers.delete(envelope.clientId);

    room.emit("peer-left", {
      clientId: envelope.clientId
    });
  }

  #handlePeerPresence(
    room: InternalRoom,
    peers: Map<string, Peer>,
    envelope: Extract<Envelope, { kind: "peer-presence"; }>
  ): void {
    const peer = peers.get(envelope.clientId);
    if (peer) {
      Object.assign(peer.presence, envelope.patch);
    }

    room.emit("peer-presence", {
      clientId: envelope.clientId,
      patch: envelope.patch
    });
  }

  #handleDenied(
    room: InternalRoom,
    envelope: Extract<Envelope, { kind: "denied"; }>
  ): void {
    room.emit("denied", {
      event: envelope.event,
      reason: envelope.reason
    });
  }

  #handleError(
    room: InternalRoom,
    envelope: Extract<Envelope, { kind: "error"; }>
  ): void {
    room.emit("error", {
      event: envelope.event,
      reason: envelope.reason
    });
  }
}
