// Import Internal Dependencies
import type { Envelope } from "../../protocol/envelope/Envelope.ts";
import type { PeerMetadata } from "../../protocol/types.ts";
import { PRESENCE_EVENT } from "../../protocol/constants.ts";
import type { ClientHandle } from "../../transport/ClientHandle.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";
import type { RightsGate } from "../rights/RightsGate.ts";
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
  event?: string;
  unreadable?: Envelope;
  excludeClientId?: string;
}

class SerializedEnvelope {
  #envelope: Envelope;
  #json: string | undefined;

  constructor(
    envelope: Envelope
  ) {
    this.#envelope = envelope;
  }

  sendTo(
    handle: ClientHandle
  ): void {
    if (handle.sendSerialized === undefined) {
      handle.send(this.#envelope);

      return;
    }

    this.#json ??= JSON.stringify(this.#envelope);
    handle.sendSerialized(this.#json);
  }
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
    envelope: Envelope,
    options: RoomSendOptions = {}
  ): void {
    const {
      event,
      unreadable,
      excludeClientId
    } = options;
    const readable = new SerializedEnvelope(envelope);
    const fallback = unreadable === undefined ?
      null :
      new SerializedEnvelope(unreadable);

    for (const [clientId, record] of this.#members) {
      if (clientId === excludeClientId) {
        continue;
      }

      if (this.#canRead(record.identity.role, event)) {
        readable.sendTo(record.handle);
      }
      else {
        fallback?.sendTo(record.handle);
      }
    }
  }

  sendTo(
    clientId: string,
    envelope: Envelope,
    event?: string
  ): void {
    const record = this.#members.get(clientId);
    if (
      record !== undefined &&
      this.#canRead(record.identity.role, event)
    ) {
      record.handle.send(envelope);
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
