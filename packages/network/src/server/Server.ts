// Import Internal Dependencies
import {
  describeEnvelopeParseError,
  Envelope,
  type ClientEnvelope
} from "../protocol/envelope/Envelope.ts";
import { errorMessage } from "../errorMessage.ts";
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
  PeerIdentity,
  RoomAdmission
} from "./auth/AuthenticationProvider.ts";
import type { RoomResolver } from "./room/RoomResolver.ts";
import { ClientSessions } from "./ClientSessions.ts";
import {
  EnvelopeDispatcher,
  type DispatchOutcome
} from "./EnvelopeDispatcher.ts";
import type { ClientConnection } from "./connection/ClientConnection.ts";
import type { ServerConnection } from "./connection/ServerConnection.ts";
import type { PeerMetadata } from "../protocol/types.ts";
import {
  REAUTHENTICATE_CLOSE_CODE,
  REAUTHENTICATE_CLOSE_REASON
} from "../protocol/constants.ts";

export interface ServerOptions {
  logger?: Logger;
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  admits?: RoomAdmission;
  /**
   * Empty resolved-room grace period in milliseconds.
   * @default 30_000
   */
  roomGraceMs?: number;
  limits?: RoomLimits;
  /**
   * When false, outbound messages are identified by their tags without being
   * validated, and a message no tag identifies is dropped.
   * @default true
   */
  validateOutbound?: boolean;
}

export class Server {
  readonly logger: Logger;

  #rooms: RoomRegistry;
  #rights: RightsTable;
  #auth: AuthenticationProvider;
  #sessions = new ClientSessions();
  #dispatcher: EnvelopeDispatcher;
  #unwatch: (() => void)[];

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
      limits: options.limits,
      validateOutbound: options.validateOutbound
    });
    this.#dispatcher = new EnvelopeDispatcher({
      rooms: this.#rooms,
      sessions: this.#sessions,
      admits: options.admits
    });
    this.#unwatch = [
      this.#auth.watchRevocations?.(
        (subject) => this.revoke(subject)
      ),
      this.#auth.watchProfiles?.(
        (subject, patch) => this.updateProfile(subject, patch)
      )
    ].filter((stop) => stop !== undefined);
  }

  register(
    extension: AnyExtension
  ): void {
    this.#rooms.register(extension);
  }

  useRoomResolver(
    resolver: RoomResolver | null
  ): void {
    this.#rooms.useResolver(resolver);
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
        () => handle.close(
          REAUTHENTICATE_CLOSE_CODE,
          REAUTHENTICATE_CLOSE_REASON
        )
      );
    }
  }

  updateProfile(
    subject: string,
    patch: PeerMetadata
  ): void {
    for (const clientId of this.#sessions.updateProfile(subject, patch)) {
      void this.#sessions.drain(clientId).then(
        () => this.#rooms.updateProfile(clientId, patch)
      );
    }
  }

  async close(): Promise<void> {
    for (const stop of this.#unwatch) {
      stop();
    }
    this.#unwatch = [];
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
    connection: ClientConnection,
    identity: PeerIdentity
  ): ServerConnection {
    const clientId = connection.id;
    this.#sessions.open(connection, identity);
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

        this.#logEnvelope(clientId, null, {
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
      this.#logEnvelope(clientId, null, {
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
    let outcome: DispatchOutcome;
    try {
      outcome = await this.#dispatcher.dispatch(clientId, envelope);
    }
    catch (error) {
      outcome = {
        outcome: "dropped",
        reason: errorMessage(error)
      };
    }

    this.#logEnvelope(clientId, envelope, outcome);
  }

  #logEnvelope(
    clientId: string,
    envelope: ClientEnvelope | null,
    outcome: DispatchOutcome
  ): void {
    const dropped = outcome.outcome === "dropped";
    if (!dropped && !this.logger.isLevelEnabled("debug")) {
      return;
    }

    const wideEvent = this.logger.withMetadata({
      clientId,
      ...(envelope === null ? {} : {
        room: envelope.room,
        kind: envelope.kind
      }),
      ...outcome
    });
    if (dropped) {
      wideEvent.warn("envelope handled");

      return;
    }

    wideEvent.debug("envelope handled");
  }
}
