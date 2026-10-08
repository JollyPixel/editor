// Import Internal Dependencies
import type { Envelope } from "../../protocol/envelope/Envelope.ts";
import type { PeerMetadata } from "../../protocol/types.ts";
import type { ClientHandle } from "../../transport/ClientHandle.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";
import type { PeerPresence } from "./PeerPresence.ts";

export interface PeerRecord {
  handle: ClientHandle;
  identity: PeerIdentity;
  profile: PeerMetadata;
  presence: PeerPresence;
}

export interface RoomMemberSnapshot {
  clientId: string;
  role: string;
  profile: PeerMetadata;
  presence: PeerMetadata;
}

export interface RoomSendOptions {
  excludeClientId?: string;
  predicate?: (
    role: string
  ) => boolean;
}

export class RoomMembers {
  #members = new Map<string, PeerRecord>();

  get size(): number {
    return this.#members.size;
  }

  get(
    clientId: string
  ): PeerRecord | undefined {
    return this.#members.get(clientId);
  }

  add(
    clientId: string,
    record: PeerRecord
  ): void {
    this.#members.set(
      clientId,
      record
    );
  }

  remove(
    clientId: string
  ): void {
    this.#members.delete(clientId);
  }

  clear(): void {
    this.#members.clear();
  }

  snapshot(): RoomMemberSnapshot[] {
    return [...this.#members].map(([clientId, record]) => {
      return {
        clientId,
        role: record.identity.role,
        profile: record.profile,
        presence: record.presence.values
      };
    });
  }

  send(
    envelope: Envelope,
    options: RoomSendOptions = {}
  ): void {
    const {
      excludeClientId,
      predicate
    } = options;

    let json: string | undefined;
    for (const [memberId, record] of this.#members) {
      if (memberId === excludeClientId) {
        continue;
      }
      if (
        predicate &&
        !predicate(record.identity.role)
      ) {
        continue;
      }

      const { handle } = record;
      if (handle.sendSerialized === undefined) {
        handle.send(envelope);
      }
      else {
        json ??= JSON.stringify(envelope);
        handle.sendSerialized(json);
      }
    }
  }
}
