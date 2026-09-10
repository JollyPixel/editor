// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  createLogger,
  type Logger
} from "../logger.ts";
import type {
  AnyExtension,
  RoomBroadcast
} from "../extension/Extension.ts";
import { RightsTable } from "../rights/RightsTable.ts";
import type { RightsGate } from "../rights/RightsGate.ts";
import { RoomMembers } from "./RoomMembers.ts";
import { RoomContextFactory } from "./RoomContextFactory.ts";
import { MessageParser } from "../../protocol/MessageParser.ts";
import {
  JOIN_EVENT,
  MESSAGE_EVENT,
  PRESENCE_EVENT
} from "../../protocol/constants.ts";
import { describeErrors } from "../../protocol/schema.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";
import type {
  ClientHandle,
  PeerMetadata,
  RoomRights
} from "../../protocol/types.ts";

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
  readonly id: string;

  get size(): number {
    return this.#members.size;
  }

  #extension: AnyExtension;
  #rights: RightsGate;
  #members = new RoomMembers();
  #logger: Logger;
  #context: RoomContextFactory;
  #roomBroadcast: RoomBroadcast;
  #inbound: MessageParser | null;
  #outbound: MessageParser | null;

  constructor(
    id: string,
    extension: AnyExtension,
    rights: RightsTable = new RightsTable(),
    options: ServerRoomOptions = {}
  ) {
    this.id = id;
    this.#extension = extension;
    this.#rights = rights.scope(extension.name);
    this.#logger = (options.logger ?? createLogger()).withContext({
      room: this.id
    });

    const { inbound, outbound } = MessageParser.fromProtocols(
      extension.protocols
    );
    this.#inbound = inbound;
    this.#outbound = outbound;

    this.#roomBroadcast = {
      broadcast: (payload) => this.#broadcast(payload),
      sendTo: (clientId, payload) => this.#sendTo(clientId, payload)
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
    const {
      clientId,
      role,
      event,
      target,
      reason,
      label
    } = options;
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

  rightsFor(
    role: string
  ): RoomRights {
    const events = new Set([
      PRESENCE_EVENT,
      ...this.#inbound?.events ?? [],
      ...this.#outbound?.events ?? []
    ]);

    return this.#rights.resolve(role, events);
  }

  async join(
    clientId: string,
    client: ClientHandle,
    identity: PeerIdentity,
    profile: PeerMetadata
  ): Promise<boolean> {
    const { role } = identity;
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

    this.#members.add(clientId, {
      handle: client,
      identity,
      profile,
      presence: {}
    });
    this.#sendSyncSnapshot(clientId, client, role);
    this.#members.send({
      room: this.id,
      kind: "peer-joined",
      clientId,
      role,
      profile
    }, { excludeClientId: clientId });

    await this.#extension.onClientConnect?.(
      {
        id: client.id,
        send: (data) => this.#sendTo(client.id, data)
      },
      {
        clientId,
        identity,
        profile,
        presence: {}
      },
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
    clientId: string,
    client: ClientHandle,
    role: string
  ): void {
    client.send({
      room: this.id,
      kind: "sync",
      self: clientId,
      rights: this.rightsFor(role),
      members: this.#members.snapshot()
    });
  }

  async leave(
    clientId: string
  ): Promise<void> {
    const actor = this.#context.resolveActor(clientId);
    this.#members.remove(clientId);
    this.#members.send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, { excludeClientId: clientId });

    await this.#extension.onClientDisconnect?.(
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

    const { role } = record.identity;
    if (!this.#authorize({
      clientId,
      role,
      event: PRESENCE_EVENT,
      target: record.handle,
      reason: `role "${role}" cannot update presence`,
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
      predicate: (peerRole) => this.#rights
        .check(peerRole, PRESENCE_EVENT) !== "void"
    });

    this.#logger
      .withMetadata({
        clientId,
        role,
        outcome: "applied"
      })
      .debug("presence update");
  }

  async message(
    clientId: string,
    payload: unknown
  ): Promise<void> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: "not a member"
        })
        .debug("message");

      return;
    }

    const { role } = record.identity;
    if (this.#inbound === null) {
      await this.#deliverMessage(clientId, payload);

      return;
    }

    const parsed = this.#inbound.parse(payload);
    if (!parsed.ok) {
      const reason = describeErrors(parsed.val);
      record.handle.send({
        room: this.id,
        kind: "error",
        event: MESSAGE_EVENT,
        reason
      });
      this.#logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason
        })
        .debug("message");

      return;
    }

    const { event, message } = parsed.val;
    if (this.#rights.configured && !this.#authorize({
      clientId,
      role,
      event,
      target: record.handle,
      reason: `role "${role}" cannot write "${event}"`,
      label: "message"
    })) {
      return;
    }

    await this.#deliverMessage(clientId, message);
  }

  async #deliverMessage(
    clientId: string,
    message: unknown
  ): Promise<void> {
    if (typeof this.#extension.onMessage !== "function") {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "unhandled",
          reason: "extension does not implement onMessage"
        })
        .debug("message");

      return;
    }

    await this.#extension.onMessage(
      clientId,
      message,
      this.#context.create(clientId)
    );
  }

  async dispose(): Promise<void> {
    this.#members.clear();
    await this.#extension.dispose?.();
  }

  #outboundEvent(
    payload: unknown
  ): string | null {
    if (this.#outbound === null) {
      return null;
    }

    const parsed = this.#outbound.parse(payload);
    if (!parsed.ok) {
      this.#logger
        .withMetadata({
          outcome: "dropped",
          reason: describeErrors(parsed.val)
        })
        .error("outbound payload does not match the extension protocol");

      return null;
    }

    return parsed.val.event;
  }

  #broadcast(
    payload: unknown
  ): void {
    if (this.#outbound !== null) {
      const event = this.#outboundEvent(payload);
      if (event === null) {
        return;
      }

      this.#members.send({
        room: this.id,
        kind: "message",
        payload
      }, {
        predicate: (role) => this.#rights.check(role, event) !== "void"
      });

      return;
    }

    this.#members.send({
      room: this.id,
      kind: "message",
      payload
    });
  }

  #sendTo(
    clientId: string,
    payload: unknown
  ): void {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      return;
    }

    if (this.#outbound !== null) {
      const event = this.#outboundEvent(payload);
      if (event === null) {
        return;
      }
      if (this.#rights.check(record.identity.role, event) === "void") {
        return;
      }
    }

    record.handle.send({
      room: this.id,
      kind: "message",
      payload
    });
  }
}
