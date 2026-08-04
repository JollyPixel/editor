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
import {
  Extension,
  type WorkerExtensionDescriptor
} from "./Extension.ts";
import { WorkerExtensionProxy } from "./worker/WorkerExtensionProxy.ts";
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

function errorMessage(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
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
  #clientQueues = new Map<string, Promise<void>>();
  #workerProxies: WorkerExtensionProxy[] = [];

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
    extension: Extension | WorkerExtensionDescriptor
  ): void {
    const resolvedExtension = extension instanceof Extension ?
      extension :
      new WorkerExtensionProxy(extension, { logger: this.logger });

    if (resolvedExtension instanceof WorkerExtensionProxy) {
      this.#workerProxies.push(resolvedExtension);
    }

    const room = new ServerRoom(
      resolvedExtension,
      this.#rights,
      {
        logger: this.logger,
        eventStore: this.#eventStore
      }
    );

    this.#rooms.set(resolvedExtension.id, room);
    this.logger
      .withMetadata({ room: resolvedExtension.id })
      .info("room registered");
  }

  async close(): Promise<void> {
    await Promise.allSettled(
      this.#workerProxies.map((proxy) => proxy.close())
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
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
  ): Promise<void> {
    return this.#enqueueForClient(
      clientId,
      () => this.#processDisconnect(clientId)
    );
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): Promise<void> {
    return this.#enqueueForClient(
      clientId,
      () => this.#processMessage(clientId, raw)
    );
  }

  /**
   * Chains dispatch for a given clientId onto its previous one, so message N+1
   * never starts until message N (including any worker round-trip) has settled.
   */
  #enqueueForClient(
    clientId: string,
    task: () => Promise<void>
  ): Promise<void> {
    const previous = this.#clientQueues.get(
      clientId
    ) ?? Promise.resolve();
    const next = previous.then(task, task);

    this.#clientQueues.set(
      clientId,
      next.catch(() => void 0)
    );

    return next;
  }

  async #processDisconnect(
    clientId: string
  ): Promise<void> {
    const record = this.#clients.get(clientId);
    const rooms = record ? [...record.rooms] : [];
    for (const roomName of rooms) {
      try {
        await this.#rooms.get(roomName)?.leave(clientId);
      }
      catch (error) {
        this.logger
          .withMetadata({
            clientId,
            room: roomName,
            reason: errorMessage(error)
          })
          .error("disconnect handling failed");
      }
    }

    this.#clients.delete(clientId);
    this.logger
      .withMetadata({ clientId, rooms })
      .debug("client disconnected");
  }

  async #processMessage(
    clientId: string,
    raw: unknown
  ): Promise<void> {
    const result = Envelope.parse(raw)
      .orTee((error) => this.logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: "malformed envelope",
          error
        })
        .warn("envelope handled"))
      .andThen((envelope) => this.#resolveClient(clientId, envelope))
      .andThen((context) => this.#resolveRoom(context));

    if (!result.ok) {
      return;
    }

    try {
      await this.#dispatchEnvelope(result.val);
    }
    catch (error) {
      this.logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: errorMessage(error)
        })
        .error("envelope handled");
    }
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

  async #dispatchEnvelope(
    context: RoomDispatchContext
  ): Promise<void> {
    const { clientId, envelope, event, record, room } = context;

    const outcome = await match(envelope)
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

  async #handleJoin(
    record: ClientRecord,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "join"; }>
  ): Promise<DispatchOutcome> {
    if (record.rooms.has(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "already joined"
      };
    }

    const admitted = await room.join(
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

  async #handleLeave(
    record: ClientRecord,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "leave"; }>
  ): Promise<DispatchOutcome> {
    if (!record.rooms.delete(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "not a member"
      };
    }

    await room.leave(record.handle.id);

    return { outcome: "left" };
  }

  async #handleMessage(
    clientId: string,
    room: ServerRoom,
    envelope: Extract<Envelope, { kind: "message"; }>
  ): Promise<DispatchOutcome> {
    if (!this.#hasJoined(clientId, envelope.room)) {
      return {
        outcome: "dropped",
        reason: "client has not joined room"
      };
    }

    await room.message(
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
