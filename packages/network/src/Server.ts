// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import { ServerRoom } from "./server/ServerRoom.ts";
import { Envelope } from "./Envelope.ts";
import {
  createLogger,
  type Logger
} from "./logger/pino.ts";
import { RightsTable, type RightsMap } from "./server/RightsTable.ts";
import type { RoomAuthority } from "./server/RoomAuthority.ts";
import type {
  ClientHandle
} from "./types.ts";

interface ClientRecord {
  handle: ClientHandle;
  rooms: Set<string>;
}

interface DispatchOutcome {
  outcome: "joined" | "left" | "handled" | "ignored" | "dropped";
  reason?: string;
}

export interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
}

/**
 * Transport-agnostic multiplexer sitting between raw connections and
 * registered RoomAuthority instances.
 */
export class Server {
  readonly logger: Logger;

  #rights: RightsTable;
  #rooms = new Map<string, ServerRoom>();
  #clients = new Map<string, ClientRecord>();

  constructor(
    options: ServerOptions = {}
  ) {
    this.logger = options.logger ?? createLogger();
    this.#rights = new RightsTable(
      options.rights
    );
  }

  register(
    authority: RoomAuthority
  ): void {
    const room = new ServerRoom(
      authority,
      this.#rights,
      this.logger
    );

    this.#rooms.set(authority.id, room);
    this.logger
      .withMetadata({ room: authority.id })
      .info("room registered");
  }

  broadcast(
    roomId: string,
    payload: unknown
  ): void {
    this.#rooms.get(roomId)?.broadcast(payload);
  }

  handleConnect(
    client: ClientHandle
  ): void {
    this.#clients.set(client.id, {
      handle: client,
      rooms: new Set()
    });
    this.logger
      .withMetadata({ clientId: client.id })
      .debug("client connected");
  }

  handleDisconnect(
    clientId: string
  ): void {
    const record = this.#clients.get(clientId);
    const rooms = record ? [...record.rooms] : [];
    for (const roomName of rooms) {
      this.#rooms.get(roomName)?.leave(clientId);
    }

    this.#clients.delete(clientId);
    this.logger
      .withMetadata({ clientId, rooms })
      .debug("client disconnected");
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): void {
    const result = Envelope.parse(raw);
    if (!result.ok) {
      this.logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: "malformed envelope",
          error: result.val
        })
        .warn("envelope handled");

      return;
    }
    const envelope = result.unwrap();
    const event = {
      clientId,
      room: envelope.room,
      kind: envelope.kind
    };

    const record = this.#clients.get(clientId);
    if (!record) {
      this.logger
        .withMetadata({
          ...event,
          outcome: "dropped",
          reason: "unknown client"
        })
        .warn("envelope handled");

      return;
    }

    const room = this.#rooms.get(envelope.room);
    if (!room) {
      this.logger
        .withMetadata({
          ...event,
          outcome: "dropped",
          reason: "unregistered room"
        })
        .warn("envelope handled");

      return;
    }

    const dispatch = match(envelope)
      .with({ kind: "join" }, (envelope) => this.#handleJoin(record, room, envelope))
      .with({ kind: "leave" }, (envelope) => this.#handleLeave(record, room, envelope))
      .with({ kind: "message" }, (envelope) => this.#handleMessage(clientId, room, envelope))
      .with({ kind: "presence" }, (envelope) => this.#handlePresence(clientId, room, envelope))
      .otherwise(() => {
        return { outcome: "ignored" as const };
      });

    const wideEvent = this.logger.withMetadata({ ...event, ...dispatch });
    if (dispatch.outcome === "dropped") {
      wideEvent.warn("envelope handled");
    }
    else {
      wideEvent.debug("envelope handled");
    }
  }

  #handleJoin(
    record: ClientRecord,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "join"; }>
  ): DispatchOutcome {
    if (record.rooms.has(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "already joined"
      };
    }

    const admitted = room.join(
      record.handle.id,
      record.handle,
      envelope.identity ?? Object.create(null)
    );
    if (!admitted) {
      return {
        outcome: "dropped",
        reason: "join denied"
      };
    }

    record.rooms.add(envelope.room);

    return { outcome: "joined" };
  }

  #handleLeave(
    record: ClientRecord,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "leave"; }>
  ): DispatchOutcome {
    if (!record.rooms.delete(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "not a member"
      };
    }

    room.leave(record.handle.id);

    return { outcome: "left" };
  }

  #handleMessage(
    clientId: string,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "message"; }>
  ): DispatchOutcome {
    if (!this.#hasJoined(clientId, envelope.room)) {
      return {
        outcome: "dropped",
        reason: "client has not joined room"
      };
    }

    room.message(
      clientId,
      envelope.payload
    );

    return { outcome: "handled" };
  }

  #handlePresence(
    clientId: string,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "presence"; }>
  ): DispatchOutcome {
    if (!this.#hasJoined(clientId, envelope.room)) {
      return {
        outcome: "dropped",
        reason: "client has not joined room"
      };
    }

    room.updatePresence(
      clientId,
      envelope.patch ?? Object.create(null)
    );

    return { outcome: "handled" };
  }

  #hasJoined(
    clientId: string,
    room: string
  ): boolean {
    return this.#clients.get(clientId)?.rooms.has(
      room
    ) ?? false;
  }
}
