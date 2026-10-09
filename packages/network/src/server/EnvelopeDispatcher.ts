// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import type {
  RoomJoinResult,
  RoomRegistry
} from "./room/RoomRegistry.ts";
import type { ClientSessions } from "./ClientSessions.ts";
import type { PeerIdentity } from "./auth/AuthenticationProvider.ts";
import type { ClientEnvelope } from "../protocol/envelope/Envelope.ts";
import type { PeerMetadata } from "../protocol/types.ts";

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

export interface DispatchOutcome {
  outcome: "joined" | "left" | "handled" | "ignored" | "dropped";
  reason?: string;
}

export interface EnvelopeDispatcherOptions {
  rooms: RoomRegistry;
  sessions: ClientSessions;
}

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
    if (session.revoked) {
      return {
        outcome: "dropped",
        reason: "revoked client"
      };
    }

    return match(envelope)
      .with({ kind: "join" }, async(envelope) => {
        const result = await this.#rooms.join(envelope.room, {
          handle: session.handle,
          identity: session.identity,
          profile: joinProfile(session.identity, envelope.profile),
          presence: envelope.presence ?? Object.create(null),
          resume: envelope.resume
        });

        return kJoinOutcomes[result];
      })
      .with({ kind: "leave" }, async(envelope) => (
        await this.#rooms.leave(envelope.room, clientId) ?
          kLeft :
          kNotMember
      ))
      .with({ kind: "message" }, (envelope) => handled(
        this.#rooms.get(envelope.room)?.message(clientId, envelope.payload)
      ))
      .with({ kind: "presence" }, (envelope) => handled(
        this.#rooms.get(envelope.room)?.updatePresence(clientId, envelope.patch)
      ))
      .with({ kind: "resync" }, (envelope) => handled(
        this.#rooms.get(envelope.room)?.resync(clientId)
      ))
      .exhaustive();
  }
}

async function handled(
  membership: boolean | Promise<boolean> | undefined
): Promise<DispatchOutcome> {
  return await membership ? kHandled : kNotJoined;
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
