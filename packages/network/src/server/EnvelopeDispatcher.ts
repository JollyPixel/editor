// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import type { RoomRegistry } from "./room/RoomRegistry.ts";
import type { ServerRoom } from "./room/ServerRoom.ts";
import type {
  ClientSession,
  ClientSessions
} from "./ClientSessions.ts";
import type { ClientEnvelope } from "../protocol/Envelope.ts";

/**
 * Result logged once for each dispatched envelope.
 */
export interface DispatchOutcome {
  outcome: "joined" | "left" | "handled" | "ignored" | "dropped";
  reason?: string;
}

export interface EnvelopeDispatcherOptions {
  rooms: RoomRegistry;
  sessions: ClientSessions;
}

/**
 * Routes a parsed envelope to its room and enforces membership per kind.
 */
export class EnvelopeDispatcher {
  #rooms: RoomRegistry;
  #sessions: ClientSessions;

  constructor(
    options: EnvelopeDispatcherOptions
  ) {
    this.#rooms = options.rooms;
    this.#sessions = options.sessions;
  }

  async dispatch(
    clientId: string,
    envelope: ClientEnvelope
  ): Promise<DispatchOutcome> {
    const session = this.#sessions.get(clientId);
    if (session === undefined) {
      return {
        outcome: "dropped",
        reason: "unknown client"
      };
    }

    const room = await this.#rooms.resolve(envelope.room, {
      create: envelope.kind === "join"
    });
    if (room === null) {
      return {
        outcome: "dropped",
        reason: "unregistered room"
      };
    }

    return match(envelope)
      .with({ kind: "join" }, (envelope) => this.#handleJoin(session, room, envelope))
      .with({ kind: "leave" }, (envelope) => this.#handleLeave(session, envelope))
      .with({ kind: "message" }, (envelope) => this.#handleMessage(session, room, envelope))
      .with({ kind: "presence" }, (envelope) => this.#handlePresence(session, room, envelope))
      .exhaustive();
  }

  async #handleJoin(
    session: ClientSession,
    room: ServerRoom,
    envelope: Extract<ClientEnvelope, { kind: "join"; }>
  ): Promise<DispatchOutcome> {
    if (session.rooms.has(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "already joined"
      };
    }

    try {
      const admitted = await room.join(
        session.handle.id,
        session.handle,
        envelope.identity ?? Object.create(null)
      );
      if (!admitted) {
        return {
          outcome: "dropped",
          reason: "join denied"
        };
      }

      session.rooms.add(envelope.room);

      return { outcome: "joined" };
    }
    finally {
      this.#rooms.syncEviction(envelope.room);
    }
  }

  async #handleLeave(
    session: ClientSession,
    envelope: Extract<ClientEnvelope, { kind: "leave"; }>
  ): Promise<DispatchOutcome> {
    if (!session.rooms.delete(envelope.room)) {
      return {
        outcome: "ignored",
        reason: "not a member"
      };
    }

    await this.#rooms.leave(
      envelope.room,
      session.handle.id
    );

    return { outcome: "left" };
  }

  async #handleMessage(
    session: ClientSession,
    room: ServerRoom,
    envelope: Extract<ClientEnvelope, { kind: "message"; }>
  ): Promise<DispatchOutcome> {
    if (!session.rooms.has(envelope.room)) {
      return {
        outcome: "dropped",
        reason: "client has not joined room"
      };
    }

    await room.message(
      session.handle.id,
      envelope.payload
    );

    return { outcome: "handled" };
  }

  #handlePresence(
    session: ClientSession,
    room: ServerRoom,
    envelope: Extract<ClientEnvelope, { kind: "presence"; }>
  ): DispatchOutcome {
    if (!session.rooms.has(envelope.room)) {
      return {
        outcome: "dropped",
        reason: "client has not joined room"
      };
    }

    room.updatePresence(
      session.handle.id,
      envelope.patch
    );

    return { outcome: "handled" };
  }
}
