// Import Internal Dependencies
import type {
  RoomJoinResult,
  RoomRegistry
} from "./room/RoomRegistry.ts";
import type {
  ClientSession,
  ClientSessions
} from "./ClientSessions.ts";
import type {
  PeerIdentity,
  RoomAdmission
} from "./auth/AuthenticationProvider.ts";
import {
  unknownEnvelopeKind,
  type ClientEnvelope
} from "../protocol/envelope/Envelope.ts";
import type { PeerMetadata } from "../protocol/types.ts";
import { JOIN_EVENT } from "../protocol/constants.ts";

// CONSTANTS
const kHandled: DispatchOutcome = { outcome: "handled" };
const kLeft: DispatchOutcome = { outcome: "left" };
const kNotMember: DispatchOutcome = {
  outcome: "ignored",
  reason: "not a member"
};
const kNotJoined: DispatchOutcome = {
  outcome: "dropped",
  reason: "client has not joined room"
};
const kJoinOutcomes: Record<RoomJoinResult, DispatchOutcome> = {
  joined: { outcome: "joined" },
  member: {
    outcome: "ignored",
    reason: "already joined"
  },
  denied: {
    outcome: "dropped",
    reason: "join denied"
  },
  unregistered: {
    outcome: "dropped",
    reason: "unregistered room"
  }
};
const kUnknownClient: DispatchOutcome = {
  outcome: "dropped",
  reason: "unknown client"
};
const kRevokedClient: DispatchOutcome = {
  outcome: "dropped",
  reason: "revoked client"
};
const kOutOfScopeReason = "identity does not cover this room";
const kOutOfScope: DispatchOutcome = {
  outcome: "dropped",
  reason: kOutOfScopeReason
};

type ClientEnvelopeOf<TKind extends ClientEnvelope["kind"]> = Extract<
  ClientEnvelope,
  { kind: TKind; }
>;

export interface DispatchOutcome {
  outcome: "joined" | "left" | "handled" | "ignored" | "dropped";
  reason?: string;
}

export interface EnvelopeDispatcherOptions {
  rooms: RoomRegistry;
  sessions: ClientSessions;
  admits?: RoomAdmission;
}

export class EnvelopeDispatcher {
  #rooms: RoomRegistry;
  #sessions: ClientSessions;
  #admits: RoomAdmission | undefined;

  constructor(
    options: EnvelopeDispatcherOptions
  ) {
    this.#rooms = options.rooms;
    this.#sessions = options.sessions;
    this.#admits = options.admits;
  }

  dispatch(
    clientId: string,
    envelope: ClientEnvelope
  ): DispatchOutcome | Promise<DispatchOutcome> {
    const session = this.#sessions.get(clientId);
    if (session === undefined) {
      return kUnknownClient;
    }
    if (session.revoked) {
      return kRevokedClient;
    }

    switch (envelope.kind) {
      case "join":
        return this.#join(session, envelope);
      case "leave":
        return this.#leave(clientId, envelope.room);
      case "message":
        return handled(
          this.#rooms.get(envelope.room)?.message(clientId, envelope.payload)
        );
      case "presence":
        return handled(
          this.#rooms.get(envelope.room)?.updatePresence(clientId, envelope.patch)
        );
      case "resync":
        return handled(
          this.#rooms.get(envelope.room)?.resync(clientId)
        );
      default:
        return unknownEnvelopeKind(envelope);
    }
  }

  async #join(
    session: ClientSession,
    envelope: ClientEnvelopeOf<"join">
  ): Promise<DispatchOutcome> {
    if (!await this.#admitted(session.identity, envelope.room)) {
      session.handle.send({
        room: envelope.room,
        kind: "denied",
        event: JOIN_EVENT,
        reason: kOutOfScopeReason
      });

      return kOutOfScope;
    }

    const result = await this.#rooms.join(envelope.room, {
      handle: session.handle,
      identity: session.identity,
      profile: joinProfile(session.identity, envelope.profile),
      presence: envelope.presence ?? Object.create(null),
      resume: envelope.resume
    });

    return kJoinOutcomes[result];
  }

  async #leave(
    clientId: string,
    room: string
  ): Promise<DispatchOutcome> {
    return await this.#rooms.leave(room, clientId) ? kLeft : kNotMember;
  }

  async #admitted(
    identity: PeerIdentity,
    room: string
  ): Promise<boolean> {
    if (this.#admits === undefined) {
      return true;
    }

    try {
      return await this.#admits(identity, room);
    }
    catch {
      return false;
    }
  }
}

function handled(
  membership: boolean | Promise<boolean> | undefined
): DispatchOutcome | Promise<DispatchOutcome> {
  if (membership instanceof Promise) {
    return membership.then(membershipOutcome);
  }

  return membershipOutcome(membership);
}

function membershipOutcome(
  membership: boolean | undefined
): DispatchOutcome {
  return membership === true ? kHandled : kNotJoined;
}

function joinProfile(
  identity: PeerIdentity,
  claimed: PeerMetadata | undefined
): PeerMetadata {
  if (identity.profile === undefined) {
    return claimed ?? Object.create(null);
  }

  return {
    ...claimed,
    ...identity.profile
  };
}
