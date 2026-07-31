// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  createLogger,
  type Logger
} from "./logger.ts";
import type {
  Extension,
  RoomBroadcast,
  RoomContext
} from "./Extension.ts";
import {
  RightsTable,
  RightsGate,
  JOIN_EVENT,
  PRESENCE_EVENT
} from "./RightsTable.ts";
import { RoomMembers } from "./RoomMembers.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../types.ts";

// CONSTANTS
const kDefaultRole = "default";

function resolveRole(
  identity: PeerMetadata
): string {
  return typeof identity.role === "string" ? identity.role : kDefaultRole;
}

export interface ServerRoomOptions {
  logger?: Logger;
  eventStore?: EventStore.EventStore;
}

export class ServerRoom {
  readonly id: string;

  #extension: Extension;
  #rights: RightsGate;
  #members = new RoomMembers();
  #logger: Logger;
  #eventStore: EventStore.EventStore;
  #roomBroadcast: RoomBroadcast;

  constructor(
    extension: Extension,
    rights: RightsTable = new RightsTable(),
    options: ServerRoomOptions = {}
  ) {
    this.id = extension.id;
    this.#extension = extension;
    this.#rights = rights.scope(extension.name);
    this.#logger = (options.logger ?? createLogger()).withContext({
      room: this.id
    });
    this.#eventStore = options.eventStore ?? EventStore.persistence.memory();
    this.#roomBroadcast = {
      broadcast: (payload) => this.#broadcast(payload)
    };
  }

  #context(
    clientId: string
  ): RoomContext {
    return {
      room: this.#roomBroadcast,
      eventStore: {
        append: (input) => this.#appendEvent(clientId, input),
        list: (assetId, fromVersion) => this.#eventStore.reader.list(assetId, fromVersion)
      }
    };
  }

  #appendEvent(
    clientId: string,
    input: EventStore.AppendInput
  ): boolean {
    const result = this.#eventStore.writer.append(input);
    if (!result.ok) {
      this.#members.get(clientId)?.handle.send({
        room: this.id,
        kind: "error",
        event: input.eventType,
        reason: result.val.message
      });
    }

    return result.ok;
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

    this.#members.send({
      room: this.id,
      kind: "peer-joined",
      clientId,
      identity
    }, { excludeClientId: clientId });
    this.#sendSyncSnapshot(client);
    this.#members.add(clientId, {
      handle: client,
      identity,
      presence: {},
      role
    });

    this.#extension.onClientConnect(
      {
        id: client.id,
        send: (data) => client.send({
          room: this.id,
          kind: "message",
          payload: data
        })
      },
      identity,
      this.#context(clientId)
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

    client.send({
      room: this.id,
      kind: "sync",
      members: this.#members.snapshot()
    });
  }

  leave(
    clientId: string
  ): void {
    this.#members.remove(clientId);
    this.#members.send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, { excludeClientId: clientId });
    this.#extension.onClientDisconnect(clientId, this.#context(clientId));
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
    this.#members.send({
      room: this.id,
      kind: "peer-presence",
      clientId,
      patch
    }, {
      excludeClientId: clientId,
      predicate: (role) => this.#rights.check(role, PRESENCE_EVENT) !== "void"
    });

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
      const event = this.#extension.getEventName(payload);
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

    this.#extension.onMessage(clientId, payload, this.#context(clientId));
  }

  #broadcast(
    payload: unknown
  ): void {
    const event = this.#rights.configured ?
      this.#extension.getEventName(payload) :
      undefined;

    this.#members.send({
      room: this.id,
      kind: "message",
      payload
    }, {
      predicate: event ? (role) => this.#rights.check(role, event) !== "void" : undefined
    });
  }
}
