// Import Internal Dependencies
import type { Envelope } from "../../protocol/Envelope.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";

export interface PeerRecord {
  handle: ClientHandle;
  identity: PeerMetadata;
  presence: PeerMetadata;
  role: string;
}

export interface RoomMemberSnapshot {
  clientId: string;
  identity: PeerMetadata;
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
        identity: record.identity,
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
        !predicate(record.role)
      ) {
        continue;
      }

      record.handle.send(envelope);
    }
  }
}
