// Import Internal Dependencies
import {
  createLogger,
  type Logger
} from "../logger.ts";
import type {
  AnyExtension,
  RoomBroadcast,
  RoomContext
} from "../extension/Extension.ts";
import { RightsTable } from "../rights/RightsTable.ts";
import type { RightsGate } from "../rights/RightsGate.ts";
import { RoomMembers } from "./RoomMembers.ts";
import { PeerPresence } from "./PeerPresence.ts";
import { ResyncThrottle } from "./ResyncThrottle.ts";
import { MessageParser } from "../../protocol/message/MessageParser.ts";
import {
  JOIN_EVENT,
  MESSAGE_EVENT,
  PRESENCE_EVENT
} from "../../protocol/constants.ts";
import { describeErrors } from "../../protocol/schema.ts";
import { errorMessage } from "../errors.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";
import type {
  PeerMetadata,
  RoomRights
} from "../../protocol/types.ts";
import type { ClientHandle } from "../../transport/ClientHandle.ts";

// CONSTANTS
const kDefaultPeerMetadataLength = 1_048_576;
const kDefaultResyncIntervalMs = 1_000;

interface AuthorizeOptions {
  clientId: string;
  role: string;
  event: string;
  target: ClientHandle;
  reason: string;
  label: string;
}

interface Refusal {
  clientId: string;
  kind: "denied" | "error";
  event: string;
  reason: string;
  label: string;
}

export interface ServerRoomJoinOptions {
  presence?: PeerMetadata;
  resume?: unknown;
}

export interface RoomLimits {
  /**
   * Longest profile, and longest merged presence, a member may hold,
   * in JSON characters. A join or presence update past it is refused.
   * @default 1_048_576
   */
  peerMetadataLength?: number;
  /**
   * Shortest interval, in milliseconds, between two resyncs of a member.
   * Requests inside it are coalesced into one resync at its end.
   * @default 1_000
   */
  resyncIntervalMs?: number;
}

export interface ServerRoomOptions {
  logger?: Logger;
  limits?: RoomLimits;
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
  #roomBroadcast: RoomBroadcast;
  #inbound: MessageParser | null;
  #outbound: MessageParser | null;
  #peerMetadataLength: number;
  #resyncs: ResyncThrottle;

  constructor(
    id: string,
    extension: AnyExtension,
    rights: RightsTable = new RightsTable(),
    options: ServerRoomOptions = {}
  ) {
    this.id = id;
    this.#extension = extension;
    this.#rights = rights.scope(extension.name);
    this.#logger = (options.logger ?? createLogger()).child().withContext({
      room: this.id
    });

    const {
      peerMetadataLength = kDefaultPeerMetadataLength,
      resyncIntervalMs = kDefaultResyncIntervalMs
    } = options.limits ?? {};
    this.#peerMetadataLength = peerMetadataLength;
    this.#resyncs = new ResyncThrottle(resyncIntervalMs);

    const { inbound, outbound } = extension.protocols;
    this.#inbound = inbound === null
      ? null
      : MessageParser.of(inbound);
    this.#outbound = outbound === null
      ? null
      : MessageParser.of(outbound);

    this.#roomBroadcast = {
      broadcast: (payload) => this.#broadcast(payload),
      sendTo: (clientId, payload) => this.#sendTo(clientId, payload)
    };
  }

  #contextFor(
    identity: PeerIdentity
  ): RoomContext {
    return {
      room: this.#roomBroadcast,
      identity
    };
  }

  #authorize(
    options: AuthorizeOptions
  ): boolean {
    const {
      role,
      target,
      ...refusal
    } = options;
    if (this.#rights.canWrite(role, refusal.event)) {
      return true;
    }

    this.#refuse(target, {
      ...refusal,
      kind: "denied"
    });

    return false;
  }

  #withinLimit(
    client: ClientHandle,
    event: string,
    subject: "profile" | "presence",
    length: number
  ): boolean {
    if (length <= this.#peerMetadataLength) {
      return true;
    }

    this.#refuse(client, {
      clientId: client.id,
      kind: "error",
      event,
      reason: `${subject} exceeds ${this.#peerMetadataLength} JSON characters`,
      label: subject
    });

    return false;
  }

  #refuse(
    target: ClientHandle,
    refusal: Refusal
  ): void {
    const {
      clientId,
      kind,
      event,
      reason,
      label
    } = refusal;
    target.send({
      room: this.id,
      kind,
      event,
      reason
    });
    this.#logger
      .withMetadata({
        clientId,
        event,
        outcome: kind === "denied" ? "denied" : "dropped",
        reason
      })
      .debug(label);
  }

  #canReadPresence(
    role: string
  ): boolean {
    return this.#rights.check(role, PRESENCE_EVENT) !== "void";
  }

  rightsFor(
    role: string
  ): RoomRights {
    const { inbound, outbound } = this.#extension.protocols;
    const events = new Set([
      PRESENCE_EVENT,
      ...inbound?.events ?? [],
      ...outbound?.events ?? []
    ]);

    return this.#rights.resolve(role, events);
  }

  async join(
    clientId: string,
    client: ClientHandle,
    identity: PeerIdentity,
    profile: PeerMetadata,
    options: ServerRoomJoinOptions = {}
  ): Promise<boolean> {
    const {
      presence = {},
      resume
    } = options;
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
    if (!this.#withinLimit(
      client,
      JOIN_EVENT,
      "profile",
      JSON.stringify(profile).length
    )) {
      return false;
    }

    const initialPresence = this.#initialPresence(
      clientId,
      client,
      role,
      presence
    );
    if (!this.#withinLimit(
      client,
      JOIN_EVENT,
      "presence",
      initialPresence.length
    )) {
      return false;
    }

    this.#members.add(clientId, {
      handle: client,
      identity,
      profile,
      presence: initialPresence
    });
    this.#sendSyncSnapshot(clientId, client, role);
    this.#announceJoin(
      clientId,
      role,
      profile,
      initialPresence.values
    );

    await this.#extension.onClientConnect?.(
      {
        id: client.id,
        send: (data) => this.#sendTo(client.id, data)
      },
      {
        clientId,
        identity,
        profile,
        presence: { ...initialPresence.values },
        ...(resume === undefined ? {} : { resume })
      },
      this.#contextFor(identity)
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

  #initialPresence(
    clientId: string,
    client: ClientHandle,
    role: string,
    presence: PeerMetadata
  ): PeerPresence {
    if (Object.keys(presence).length === 0) {
      return PeerPresence.EMPTY;
    }

    const authorized = this.#authorize({
      clientId,
      role,
      event: PRESENCE_EVENT,
      target: client,
      reason: `role "${role}" cannot update presence`,
      label: "join presence"
    });

    return authorized ?
      PeerPresence.EMPTY.patched(presence) :
      PeerPresence.EMPTY;
  }

  #announceJoin(
    clientId: string,
    role: string,
    profile: PeerMetadata,
    presence: PeerMetadata
  ): void {
    const envelope = {
      room: this.id,
      kind: "peer-joined",
      clientId,
      role,
      profile
    } as const;

    this.#members.send({
      ...envelope,
      presence
    }, {
      excludeClientId: clientId,
      predicate: (peerRole) => this.#canReadPresence(peerRole)
    });
    this.#members.send({
      ...envelope,
      presence: {}
    }, {
      excludeClientId: clientId,
      predicate: (peerRole) => !this.#canReadPresence(peerRole)
    });
  }

  #sendSyncSnapshot(
    clientId: string,
    client: ClientHandle,
    role: string
  ): void {
    const members = this.#members.snapshot();
    client.send({
      room: this.id,
      kind: "sync",
      self: clientId,
      rights: this.rightsFor(role),
      members: this.#canReadPresence(role) ?
        members :
        members.map((member) => {
          return {
            ...member,
            presence: {}
          };
        })
    });
  }

  async leave(
    clientId: string
  ): Promise<void> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "ignored",
          reason: "not a member"
        })
        .debug("leave");

      return;
    }

    this.#members.remove(clientId);
    this.#resyncs.forget(clientId);
    this.#members.send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, { excludeClientId: clientId });

    await this.#extension.onClientDisconnect?.(
      clientId,
      this.#contextFor(record.identity)
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

    const presence = record.presence.patched(patch);
    if (!this.#withinLimit(
      record.handle,
      PRESENCE_EVENT,
      "presence",
      presence.length
    )) {
      return;
    }

    record.presence = presence;
    this.#members.send({
      room: this.id,
      kind: "peer-presence",
      clientId,
      patch
    }, {
      excludeClientId: clientId,
      predicate: (peerRole) => this.#canReadPresence(peerRole)
    });

    if (this.#logger.isLevelEnabled("debug")) {
      this.#logger
        .withMetadata({
          clientId,
          role,
          outcome: "applied"
        })
        .debug("presence update");
    }
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

    const { identity } = record;
    const { role } = identity;
    if (this.#inbound === null) {
      await this.#deliverMessage(
        clientId,
        identity,
        payload
      );

      return;
    }

    const parsed = this.#inbound.parse(payload);
    if (!parsed.ok) {
      this.#refuse(record.handle, {
        clientId,
        kind: "error",
        event: MESSAGE_EVENT,
        reason: describeErrors(parsed.val),
        label: "message"
      });

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

    await this.#deliverMessage(
      clientId,
      identity,
      message
    );
  }

  async resync(
    clientId: string
  ): Promise<void> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "dropped",
          reason: "not a member"
        })
        .debug("resync");

      return;
    }

    await this.#resyncs.request(
      clientId,
      () => this.#runResync(clientId)
    );
  }

  async #runResync(
    clientId: string
  ): Promise<void> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      return;
    }

    try {
      await this.#extension.onResync?.(
        clientId,
        this.#contextFor(record.identity)
      );
    }
    catch (error) {
      this.#logger
        .withMetadata({
          clientId,
          outcome: "failed",
          reason: errorMessage(error)
        })
        .error("resync");
    }
  }

  async #deliverMessage(
    clientId: string,
    identity: PeerIdentity,
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
      this.#contextFor(identity)
    );
  }

  async dispose(): Promise<void> {
    this.#members.clear();
    this.#resyncs.clear();
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
