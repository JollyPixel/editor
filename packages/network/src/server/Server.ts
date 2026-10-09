// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope
} from "../protocol/envelope/Envelope.ts";
import { errorMessage } from "./errors.ts";
import {
  createLogger,
  type Logger
} from "./logger.ts";
import {
  RightsTable,
  type RightsMap
} from "./rights/RightsTable.ts";
import type { AnyExtension } from "./extension/Extension.ts";
import { RoomRegistry } from "./room/RoomRegistry.ts";
import type { RoomLimits } from "./room/ServerRoom.ts";
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
import type { ClientHandle } from "../transport/ClientHandle.ts";
import {
  REAUTHENTICATE_CLOSE_CODE,
  REAUTHENTICATE_CLOSE_REASON
} from "../transport/constants.ts";

interface EnvelopeFields {
  clientId: string;
  room?: string;
  kind?: string;
}

export interface ServerConnection {
  readonly id: string;
  receive(
    raw: unknown
  ): Promise<void>;
  close(): Promise<void>;
}

export interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  roomGraceMs?: number;
  limits?: RoomLimits;
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
  #stopRevocations: () => void;

  constructor(
    options: ServerOptions = {}
  ) {
    this.logger = options.logger ?? createLogger();

    this.#rights = new RightsTable(options.rights, options.defaultRole);
    this.#auth = options.auth ?? new BypassAuthentication();
    this.#rooms = new RoomRegistry({
      logger: this.logger,
      rights: this.#rights,
      graceMs: options.roomGraceMs,
      limits: options.limits
    });
    this.#dispatcher = new EnvelopeDispatcher({
      rooms: this.#rooms,
      sessions: this.#sessions
    });
    this.#stopRevocations = this.#auth.watchRevocations?.(
      (subject) => this.revoke(subject)
    ) ?? (() => void 0);
  }

  register(
    extension: AnyExtension
  ): void {
    this.#rooms.register(extension);
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

  revoke(
    subject: string
  ): void {
    for (const handle of this.#sessions.revoke(subject)) {
      void this.#sessions.drain(handle.id).then(
        () => handle.close?.(
          REAUTHENTICATE_CLOSE_CODE,
          REAUTHENTICATE_CLOSE_REASON
        )
      );
    }
  }

  async close(): Promise<void> {
    this.#stopRevocations();
    this.#stopRevocations = () => void 0;
    this.#sessions.clear();
    await this.#rooms.close();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async authenticate(
    attempt: AuthenticationAttempt
  ): Promise<PeerIdentity | null> {
    let identity: PeerIdentity | null = null;
    try {
      identity = await this.#auth.authenticate({
        ...attempt,
        defaultRole: this.#rights.defaultRole
      });
    }
    catch (error) {
      this.logger
        .withError(error)
        .error("authentication provider failed");
    }

    if (identity === null) {
      this.logger
        .withMetadata({
          clientId: attempt.clientId,
          remoteAddress: attempt.remoteAddress,
          outcome: "unauthorized"
        })
        .warn("client rejected");
    }

    return identity;
  }

  connect(
    client: ClientHandle,
    identity: PeerIdentity
  ): ServerConnection {
    const clientId = client.id;
    this.#sessions.open(client, identity);
    this.logger
      .withMetadata({
        clientId,
        subject: identity.subject,
        role: identity.role
      })
      .debug("client connected");

    let closing: Promise<void> | null = null;

    return {
      id: clientId,
      receive: (raw) => {
        if (closing === null) {
          return this.#receive(clientId, raw);
        }

        this.#logEnvelope({ clientId }, {
          outcome: "dropped",
          reason: "closed connection"
        });

        return Promise.resolve();
      },
      close: () => {
        closing ??= this.#disconnect(clientId);

        return closing;
      }
    };
  }

  async #disconnect(
    clientId: string
  ): Promise<void> {
    await this.#sessions.drain(clientId);
    const rooms = await this.#rooms.leaveAll(clientId);
    this.#sessions.close(clientId);
    this.logger
      .withMetadata({ clientId, rooms })
      .debug("client disconnected");
  }

  #receive(
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
    const dropped = outcome.outcome === "dropped";
    if (!dropped && !this.logger.isLevelEnabled("debug")) {
      return;
    }

    const wideEvent = this.logger.withMetadata({
      ...fields,
      ...outcome
    });
    if (dropped) {
      wideEvent.warn("envelope handled");

      return;
    }

    wideEvent.debug("envelope handled");
  }
}
