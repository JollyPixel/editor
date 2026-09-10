// Import Internal Dependencies
import type { Envelope } from "../../protocol/Envelope.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";

export interface PeerRecord {
  handle: ClientHandle;
  identity: PeerIdentity;
  profile: PeerMetadata;
  presence: PeerMetadata;
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
        presence: record.presence
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

      record.handle.send(envelope);
    }
  }
}
