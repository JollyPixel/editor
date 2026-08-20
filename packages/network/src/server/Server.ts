// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { Envelope } from "../protocol/Envelope.ts";
import { errorMessage } from "./errors.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";
import {
  RightsTable,
  type RightsMap
} from "./rights/RightsTable.ts";
import {
  Extension,
  type WorkerExtensionDescriptor
} from "./extension/Extension.ts";
import { WorkerExtensionProxy } from "./extension/worker/WorkerExtensionProxy.ts";
import { RoomRegistry } from "./room/RoomRegistry.ts";
import type { RoomResolver } from "./room/RoomResolver.ts";
import type { Timers } from "./room/timers.ts";
import { ClientSessions } from "./ClientSessions.ts";
import {
  EnvelopeDispatcher,
  type DispatchOutcome
} from "./EnvelopeDispatcher.ts";
import type { ClientHandle } from "../protocol/types.ts";

interface EnvelopeFields {
  clientId: string;
  room?: string;
  kind?: string;
}

export interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
  eventStore?: EventStore.EventStore;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  roomGraceMs?: number;
  /**
   * Clock behind room eviction. Injected so a caller can drive the grace
   * period instead of waiting on it.
   */
  timers?: Timers;
}

/**
 * Dispatches transport envelopes to rooms in per-client order.
 */
export class Server {
  readonly logger: Logger;

  #rooms: RoomRegistry;
  #sessions = new ClientSessions();
  #dispatcher: EnvelopeDispatcher;
  #workerProxies: WorkerExtensionProxy[] = [];

  constructor(
    options: ServerOptions = {}
  ) {
    this.logger = options.logger ?? createLogger();

    const eventStore = options.eventStore ?? EventStore.persistence.memory();
    eventStore.writer.on("append", (event) => this.logger
      .withMetadata({
        assetType: event.assetType,
        assetId: event.assetId,
        eventType: event.eventType,
        eventVersion: event.eventVersion
      })
      .debug("append event"));
    eventStore.writer.on("error", (error, input) => this.logger
      .withMetadata({
        assetType: input.assetType,
        assetId: input.assetId,
        eventType: input.eventType,
        reason: error.message,
        outcome: "failed"
      })
      .error("append event"));

    this.#rooms = new RoomRegistry({
      logger: this.logger,
      rights: new RightsTable(options.rights),
      eventStore,
      graceMs: options.roomGraceMs,
      timers: options.timers
    });
    this.#dispatcher = new EnvelopeDispatcher({
      rooms: this.#rooms,
      sessions: this.#sessions
    });
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

    this.#rooms.register(resolvedExtension);
  }

  /**
   * Sets the resolver for rooms not registered in advance.
   */
  setRoomResolver(
    resolver: RoomResolver | null
  ): void {
    this.#rooms.setResolver(resolver);
  }

  /**
   * Resolves once in-flight room evictions have finished, for one room or
   * all of them. Callers that need an evicted room's state flushed await
   * this after the grace period elapses.
   */
  settled(
    roomName?: string
  ): Promise<void> {
    return this.#rooms.settled(roomName);
  }

  async close(): Promise<void> {
    this.#sessions.clear();
    await this.#rooms.close();

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
    this.#sessions.open(client);
    this.logger
      .withMetadata({ clientId: client.id })
      .debug("client connected");
  }

  handleDisconnect(
    clientId: string
  ): Promise<void> {
    return this.#sessions.enqueue(
      clientId,
      () => this.#processDisconnect(clientId)
    );
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): Promise<void> {
    return this.#sessions.enqueue(
      clientId,
      () => this.#processMessage(clientId, raw)
    );
  }

  async #processDisconnect(
    clientId: string
  ): Promise<void> {
    const session = this.#sessions.get(clientId);
    const rooms = session ? [...session.rooms] : [];

    for (const name of rooms) {
      try {
        await this.#rooms.leave(name, clientId);
      }
      catch (error) {
        this.logger
          .withMetadata({
            clientId,
            room: name,
            reason: errorMessage(error)
          })
          .error("disconnect handling failed");
      }
    }

    this.#sessions.close(clientId);
    this.logger
      .withMetadata({ clientId, rooms })
      .debug("client disconnected");
  }

  async #processMessage(
    clientId: string,
    raw: unknown
  ): Promise<void> {
    const parsed = Envelope.parse(raw);
    if (!parsed.ok) {
      this.#logEnvelope({ clientId }, {
        outcome: "dropped",
        reason: `malformed envelope: ${parsed.val}`
      });

      return;
    }

    const envelope = parsed.val;
    const outcome = await this.#dispatcher.dispatch(clientId, envelope)
      .catch((error): DispatchOutcome => {
        return {
          outcome: "dropped",
          reason: errorMessage(error)
        };
      });

    this.#logEnvelope({
      clientId,
      room: envelope.room,
      kind: envelope.kind
    }, outcome);
  }

  #logEnvelope(
    fields: EnvelopeFields,
    outcome: DispatchOutcome
  ): void {
    const wideEvent = this.logger.withMetadata({
      ...fields,
      ...outcome
    });

    if (outcome.outcome === "dropped") {
      wideEvent.warn("envelope handled");

      return;
    }

    wideEvent.debug("envelope handled");
  }
}
