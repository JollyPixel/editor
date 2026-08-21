// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  createLogger,
  type Logger
} from "../logger.ts";
import type {
  Extension,
  RoomBroadcast
} from "../extension/Extension.ts";
import { RightsTable } from "../rights/RightsTable.ts";
import type { RightsGate } from "../rights/RightsGate.ts";
import { RoomMembers } from "./RoomMembers.ts";
import { RoomContextFactory } from "./RoomContextFactory.ts";
import {
  JOIN_EVENT,
  PRESENCE_EVENT
} from "../../protocol/constants.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";

// CONSTANTS
const kDefaultRole = "default";

function resolveRole(
  identity: PeerMetadata
): string {
  return typeof identity.role === "string"
    ? identity.role
    : kDefaultRole;
}

interface AuthorizeOptions {
  clientId: string;
  role: string;
  event: string;
  target: ClientHandle | undefined;
  reason: string;
  label: string;
}

export interface ServerRoomOptions {
  logger?: Logger;
  eventStore?: EventStore.EventStore;
}

export class ServerRoom {
  /**
   * Client-visible room name, which may differ from the extension id.
   */
  readonly id: string;

  /**
   * Joined member count used by eviction.
   */
  get size(): number {
    return this.#members.size;
  }

  #extension: Extension;
  #rights: RightsGate;
  #members = new RoomMembers();
  #logger: Logger;
  #context: RoomContextFactory;
  #roomBroadcast: RoomBroadcast;

  constructor(
    id: string,
    extension: Extension,
    rights: RightsTable = new RightsTable(),
    options: ServerRoomOptions = {}
  ) {
    this.id = id;
    this.#extension = extension;
    this.#rights = rights.scope(extension.name);
    this.#logger = (options.logger ?? createLogger()).withContext({
      room: this.id
    });

    this.#roomBroadcast = {
      broadcast: (payload) => this.#broadcast(payload),
      sendTo: (clientId, payload) => this.#members.get(clientId)?.handle.send({
        room: this.id,
        kind: "message",
        payload
      })
    };
    this.#context = new RoomContextFactory({
      roomId: this.id,
      members: this.#members,
      broadcast: this.#roomBroadcast,
      eventStore: options.eventStore
    });
  }

  #authorize(
    options: AuthorizeOptions
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
      .withMetadata({
        clientId,
        role,
        event,
        outcome: "denied"
      })
      .debug(label);

    return false;
  }

  async join(
    clientId: string,
    client: ClientHandle,
    identity: PeerMetadata
  ): Promise<boolean> {
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

    await this.#extension.onClientConnect(
      {
        id: client.id,
        send: (data) => client.send({
          room: this.id,
          kind: "message",
          payload: data
        })
      },
      identity,
      this.#context.create(clientId)
    );
    this.#logger
      .withMetadata({
        clientId,
        role,
        outcome: "admitted"
      })
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

  async leave(
    clientId: string
  ): Promise<void> {
    // Resolve before removal because membership owns the actor identity.
    const actor = this.#context.resolveActor(clientId);
    this.#members.remove(clientId);
    this.#members.send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, { excludeClientId: clientId });

    await this.#extension.onClientDisconnect(
      clientId,
      this.#context.create(clientId, actor)
    );
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

  async message(
    clientId: string,
    payload: unknown
  ): Promise<void> {
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

    await this.#extension.onMessage(
      clientId,
      payload,
      this.#context.create(clientId)
    );
  }

  async dispose(): Promise<void> {
    this.#members.clear();
    await this.#extension.dispose?.();
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
