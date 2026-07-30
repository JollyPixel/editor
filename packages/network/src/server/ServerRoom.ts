// Import Internal Dependencies
import {
  createLogger,
  type Logger
} from "../logger/pino.ts";
import type { RoomAuthority } from "./RoomAuthority.ts";
import {
  RightsTable,
  RightsGate,
  JOIN_EVENT,
  PRESENCE_EVENT
} from "./RightsTable.ts";
import type { Envelope } from "../Envelope.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../types.ts";

// CONSTANTS
const kDefaultRole = "default";

interface PeerRecord {
  handle: ClientHandle;
  identity: PeerMetadata;
  presence: PeerMetadata;
  role: string;
}

function resolveRole(
  identity: PeerMetadata
): string {
  return typeof identity.role === "string" ? identity.role : kDefaultRole;
}

export class ServerRoom {
  readonly id: string;

  #authority: RoomAuthority;
  #rights: RightsGate;
  #members = new Map<string, PeerRecord>();
  #logger: Logger;

  constructor(
    authority: RoomAuthority,
    rights: RightsTable = new RightsTable(),
    logger: Logger = createLogger()
  ) {
    this.id = authority.id;
    this.#authority = authority;
    this.#rights = rights.scope(authority.name);
    this.#logger = logger.withContext({
      room: this.id
    });
  }

  #authorize(
    options: {
      clientId: string;
      role: string;
      event: string;
      target: ClientHandle | undefined;
      reason: string;
      label: string;
    }
  ): boolean {
    const { clientId, role, event, target, reason, label } = options;
    if (this.#rights.canWrite(role, event)) {
      return true;
    }

    target?.send({
      room: this.id,
      kind: "denied",
      event,
      reason
    });
    this.#logger
      .withMetadata({ clientId, role, event, outcome: "denied" })
      .debug(label);

    return false;
  }

  join(
    clientId: string,
    client: ClientHandle,
    identity: PeerMetadata
  ): boolean {
    const role = resolveRole(identity);
    if (!this.#authorize({
      clientId,
      role,
      event: JOIN_EVENT,
      target: client,
      reason: `role "${role}" is not permitted to join this room`,
      label: "join"
    })) {
      return false;
    }

    this.#send({
      room: this.id,
      kind: "peer-joined",
      clientId,
      identity
    }, clientId);
    this.#sendSyncSnapshot(client);
    this.#members.set(clientId, {
      handle: client,
      identity,
      presence: {},
      role
    });

    this.#authority.onClientConnect(
      {
        id: client.id,
        send: (data) => client.send({
          room: this.id,
          kind: "message",
          payload: data
        })
      },
      identity,
      this
    );
    this.#logger
      .withMetadata({ clientId, role, outcome: "admitted" })
      .debug("join");

    return true;
  }

  #sendSyncSnapshot(
    client: ClientHandle
  ): void {
    if (this.#members.size === 0) {
      return;
    }

    const members = [...this.#members].map(([memberId, record]) => {
      return {
        clientId: memberId,
        identity: record.identity,
        presence: record.presence
      };
    });

    client.send({
      room: this.id,
      kind: "sync",
      members
    });
  }

  leave(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    this.#send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, clientId);
    this.#authority.onClientDisconnect(clientId, this);
    this.#logger
      .withMetadata({ clientId })
      .debug("leave");
  }

  updatePresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    const record = this.#members.get(clientId);
    if (!record) {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "ignored",
          reason: "not a member"
        })
        .debug("presence update");

      return;
    }

    if (!this.#authorize({
      clientId,
      role: record.role,
      event: PRESENCE_EVENT,
      target: record.handle,
      reason: `role "${record.role}" cannot update presence`,
      label: "presence update"
    })) {
      return;
    }

    Object.assign(record.presence, patch);
    this.#send({
      room: this.id,
      kind: "peer-presence",
      clientId,
      patch
    }, clientId, PRESENCE_EVENT);

    this.#logger
      .withMetadata({
        clientId,
        role: record.role,
        outcome: "applied"
      })
      .debug("presence update");
  }

  message(
    clientId: string,
    payload: unknown
  ): void {
    const role = this.#members.get(clientId)?.role ?? kDefaultRole;

    if (this.#rights.configured) {
      const event = this.#authority.getEventName(payload);
      if (!this.#authorize({
        clientId,
        role,
        event,
        target: this.#members.get(clientId)?.handle,
        reason: `role "${role}" cannot write "${event}"`,
        label: "message"
      })) {
        return;
      }
    }

    this.#authority.onMessage(clientId, payload, this);
  }

  broadcast(
    payload: unknown
  ): void {
    const event = this.#rights.configured ?
      this.#authority.getEventName(payload) :
      undefined;

    this.#send({
      room: this.id,
      kind: "message",
      payload
    }, undefined, event);
  }

  #send(
    envelope: Envelope,
    excludeClientId?: string,
    filterEvent?: string
  ): void {
    for (const [memberId, record] of this.#members) {
      if (memberId === excludeClientId) {
        continue;
      }
      if (
        filterEvent &&
        this.#rights.check(record.role, filterEvent) === "void"
      ) {
        continue;
      }

      record.handle.send(envelope);
    }
  }
}
