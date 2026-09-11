// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope
} from "../protocol/Envelope.ts";
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
  type AnyExtension,
  type WorkerExtensionDescriptor
} from "./extension/Extension.ts";
import { WorkerExtensionProxy } from "./extension/worker/WorkerExtensionProxy.ts";
import { RoomRegistry } from "./room/RoomRegistry.ts";
import { BypassAuthentication } from "./auth/providers/BypassAuthentication.ts";
import type {
  AuthenticationAttempt,
  AuthenticationProvider,
  PeerIdentity
} from "./auth/AuthenticationProvider.ts";
import type { RoomResolver } from "./room/RoomResolver.ts";
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
  defaultRole?: string;
  auth?: AuthenticationProvider;
  eventStore?: EventStore.EventStore;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  roomGraceMs?: number;
}

/**
 * Dispatches transport envelopes to rooms in per-client order.
 */
export class Server {
  readonly logger: Logger;

  #rooms: RoomRegistry;
  #rights: RightsTable;
  #auth: AuthenticationProvider;
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

    this.#rights = new RightsTable(options.rights, options.defaultRole);
    this.#auth = options.auth ?? new BypassAuthentication();
    this.#rooms = new RoomRegistry({
      logger: this.logger,
      rights: this.#rights,
      eventStore,
      graceMs: options.roomGraceMs
    });
    this.#dispatcher = new EnvelopeDispatcher({
      rooms: this.#rooms,
      sessions: this.#sessions
    });
  }

  register(
    extension: AnyExtension | WorkerExtensionDescriptor
  ): void {
    const resolvedExtension = extension instanceof Extension ?
      extension :
      new WorkerExtensionProxy(extension, { logger: this.logger });

    if (resolvedExtension instanceof WorkerExtensionProxy) {
      this.#workerProxies.push(resolvedExtension);
    }

    this.#rooms.register(resolvedExtension);
  }

  setRoomResolver(
    resolver: RoomResolver | null
  ): void {
    this.#rooms.setResolver(resolver);
  }

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

  authenticate(
    attempt: AuthenticationAttempt
  ): PeerIdentity | null | Promise<PeerIdentity | null> {
    return this.#auth.authenticate({
      ...attempt,
      defaultRole: this.#rights.defaultRole
    });
  }

  handleConnect(
    client: ClientHandle,
    identity: PeerIdentity
  ): void {
    this.#sessions.open(client, identity);
    this.logger
      .withMetadata({
        clientId: client.id,
        subject: identity.subject,
        role: identity.role
      })
      .debug("client connected");
  }

  async handleDisconnect(
    clientId: string
  ): Promise<void> {
    await this.#sessions.drain(clientId);
    await this.#processDisconnect(clientId);
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): Promise<void> {
    const parsed = Envelope.parseClient(raw);
    if (!parsed.ok) {
      this.#logEnvelope({ clientId }, {
        outcome: "dropped",
        reason: `malformed envelope: ${describeEnvelopeParseError(parsed.val)}`
      });

      return Promise.resolve();
    }

    const envelope = parsed.val;

    return this.#sessions.enqueue(
      clientId,
      () => this.#processMessage(clientId, envelope),
      envelope.room
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
    envelope: ClientEnvelope
  ): Promise<void> {
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
