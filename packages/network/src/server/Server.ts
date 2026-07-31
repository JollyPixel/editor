// Import Third-party Dependencies
import { match } from "ts-pattern";
import {
  Ok,
  Err,
  type Result
} from "@openally/result";
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { ServerRoom } from "./ServerRoom.ts";
import { Envelope } from "../Envelope.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";
import {
  RightsTable,
  type RightsMap
} from "./RightsTable.ts";
import type { Extension } from "./Extension.ts";
import type {
  ClientHandle
} from "../types.ts";

interface ClientRecord {
  handle: ClientHandle;
  rooms: Set<string>;
}

interface DispatchOutcome {
  outcome: "joined" | "left" | "handled" | "ignored" | "dropped";
  reason?: string;
}

interface DispatchEvent {
  clientId: string;
  room: string;
  kind: string;
}

interface DispatchContext {
  clientId: string;
  envelope: Envelope;
  event: DispatchEvent;
  record: ClientRecord;
}

interface RoomDispatchContext extends DispatchContext {
  room: ServerRoom;
}

export interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
  eventStore?: EventStore.EventStore;
}

/**
 * Transport-agnostic multiplexer sitting between raw connections and
 * registered Extension instances.
 */
export class Server {
  readonly logger: Logger;

  #rights: RightsTable;
  #eventStore: EventStore.EventStore;
  #rooms = new Map<string, ServerRoom>();
  #clients = new Map<string, ClientRecord>();

  constructor(
    options: ServerOptions = {}
  ) {
    this.logger = options.logger ?? createLogger();
    this.#rights = new RightsTable(
      options.rights
    );
    this.#eventStore = options.eventStore ?? EventStore.persistence.memory();
    this.#eventStore.writer.on("append", (event) => this.logger
      .withMetadata({
        assetType: event.assetType,
        assetId: event.assetId,
        eventType: event.eventType,
        eventVersion: event.eventVersion
      })
      .debug("append event"));
    this.#eventStore.writer.on("error", (error, input) => this.logger
      .withMetadata({
        assetType: input.assetType,
        assetId: input.assetId,
        eventType: input.eventType,
        reason: error.message,
        outcome: "failed"
      })
      .error("append event"));
  }

  register(
    extension: Extension
  ): void {
    const room = new ServerRoom(
      extension,
      this.#rights,
      {
        logger: this.logger,
        eventStore: this.#eventStore
      }
    );

    this.#rooms.set(extension.id, room);
    this.logger
      .withMetadata({ room: extension.id })
      .info("room registered");
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
    Envelope.parse(raw)
      .orTee((error) => this.logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: "malformed envelope",
          error
        })
        .warn("envelope handled"))
      .andThen((envelope) => this.#resolveClient(clientId, envelope))
      .andThen((context) => this.#resolveRoom(context))
      .andTee((context) => this.#dispatchEnvelope(context));
  }

  #resolveClient(
    clientId: string,
    envelope: Envelope
  ): Result<DispatchContext, void> {
    const event: DispatchEvent = {
      clientId,
      room: envelope.room,
      kind: envelope.kind
    };
    const record = this.#clients.get(clientId);
    const result: Result<DispatchContext, void> = record ?
      Ok({ clientId, envelope, event, record }) :
      Err(undefined);

    return result.orTee(() => this.logger
      .withMetadata({
        ...event,
        outcome: "dropped",
        reason: "unknown client"
      })
      .warn("envelope handled"));
  }

  #resolveRoom(
    context: DispatchContext
  ): Result<RoomDispatchContext, void> {
    const room = this.#rooms.get(context.event.room);
    const result: Result<RoomDispatchContext, void> = room ?
      Ok({ ...context, room }) :
      Err(undefined);

    return result.orTee(() => this.logger
      .withMetadata({
        ...context.event,
        outcome: "dropped",
        reason: "unregistered room"
      })
      .warn("envelope handled"));
  }

  #dispatchEnvelope(
    context: RoomDispatchContext
  ): void {
    const { clientId, envelope, event, record, room } = context;

    const outcome = match(envelope)
      .with({ kind: "join" }, (envelope) => this.#handleJoin(record, room, envelope))
      .with({ kind: "leave" }, (envelope) => this.#handleLeave(record, room, envelope))
      .with({ kind: "message" }, (envelope) => this.#handleMessage(clientId, room, envelope))
      .with({ kind: "presence" }, (envelope) => this.#handlePresence(clientId, room, envelope))
      .otherwise(() => {
        return { outcome: "ignored" as const };
      });

    const wideEvent = this.logger.withMetadata({
      ...event,
      ...outcome
    });
    if (outcome.outcome === "dropped") {
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
