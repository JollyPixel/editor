// Import Internal Dependencies
import type { PeerMetadata } from "../../protocol/types.ts";
import { PRESENCE_EVENT } from "../../protocol/constants.ts";
import type { ClientHandle } from "../../transport/ClientHandle.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";
import type { RightsGate } from "../rights/RightsGate.ts";
import type { RoomContext } from "../extension/Extension.ts";
import type { PeerPresence } from "./PeerPresence.ts";
import type { SerializedEnvelope } from "./SerializedEnvelope.ts";

export interface PeerRecord {
  handle: ClientHandle;
  identity: PeerIdentity;
  profile: PeerMetadata;
  presence: PeerPresence;
  readonly context: RoomContext;
}

export interface RoomMemberSnapshot {
  clientId: string;
  role: string;
  profile: PeerMetadata;
  presence: PeerMetadata;
}

export interface RoomSendOptions {
  event?: string;
  unreadable?: SerializedEnvelope;
  excludeClientId?: string;
}

export class RoomMembers {
  #members = new Map<string, PeerRecord>();
  #rights: RightsGate;

  constructor(
    rights: RightsGate
  ) {
    this.#rights = rights;
  }

  get size(): number {
    return this.#members.size;
  }

  has(
    clientId: string
  ): boolean {
    return this.#members.has(clientId);
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

  snapshotFor(
    role: string
  ): RoomMemberSnapshot[] {
    const withPresence = this.#canRead(role, PRESENCE_EVENT);

    return [...this.#members].map(([clientId, record]) => {
      return {
        clientId,
        role: record.identity.role,
        profile: record.profile,
        presence: withPresence ? record.presence.values : {}
      };
    });
  }

  send(
    message: SerializedEnvelope,
    options: RoomSendOptions = {}
  ): void {
    const {
      event,
      unreadable,
      excludeClientId
    } = options;
    for (const record of this.#members.values()) {
      if (record.handle.id === excludeClientId) {
        continue;
      }

      if (this.#canRead(record.identity.role, event)) {
        message.sendTo(record.handle);
      }
      else {
        unreadable?.sendTo(record.handle);
      }
    }
  }

  sendTo(
    clientId: string,
    message: SerializedEnvelope,
    event?: string
  ): void {
    const record = this.#members.get(clientId);
    if (
      record !== undefined &&
      this.#canRead(record.identity.role, event)
    ) {
      message.sendTo(record.handle);
    }
  }

  #canRead(
    role: string,
    event: string | undefined
  ): boolean {
    return event === undefined ||
      this.#rights.check(role, event) !== "void";
  }
}
