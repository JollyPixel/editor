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
import {
  RoomMembers,
  type PeerRecord
} from "./RoomMembers.ts";
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

export interface RoomJoiner {
  handle: ClientHandle;
  identity: PeerIdentity;
  profile?: PeerMetadata;
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

  has(
    clientId: string
  ): boolean {
    return this.#members.has(clientId);
  }

  #extension: AnyExtension;
  #rights: RightsGate;
  #members: RoomMembers;
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
    this.#members = new RoomMembers(this.#rights);
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
      broadcast: (payload) => this.#deliver(payload),
      sendTo: (clientId, payload) => this.#deliver(payload, clientId)
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
    joiner: RoomJoiner
  ): Promise<boolean> {
    const {
      handle: client,
      identity,
      profile = {},
      presence = {},
      resume
    } = joiner;
    const clientId = client.id;
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
        id: clientId,
        send: (data) => this.#deliver(data, clientId)
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
      event: PRESENCE_EVENT,
      unreadable: {
        ...envelope,
        presence: {}
      },
      excludeClientId: clientId
    });
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
      members: this.#members.snapshotFor(role)
    });
  }

  async leave(
    clientId: string
  ): Promise<boolean> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      return false;
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

    return true;
  }

  updatePresence(
    clientId: string,
    patch: PeerMetadata
  ): boolean {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      return false;
    }

    this.#patchPresence(
      clientId,
      record,
      patch
    );

    return true;
  }

  #patchPresence(
    clientId: string,
    record: PeerRecord,
    patch: PeerMetadata
  ): void {
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
      event: PRESENCE_EVENT,
      excludeClientId: clientId
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
  ): Promise<boolean> {
    const record = this.#members.get(clientId);
    if (record === undefined) {
      return false;
    }

    await this.#receiveMessage(
      clientId,
      record,
      payload
    );

    return true;
  }

  async #receiveMessage(
    clientId: string,
    record: PeerRecord,
    payload: unknown
  ): Promise<void> {
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
  ): Promise<boolean> {
    if (!this.has(clientId)) {
      return false;
    }

    await this.#resyncs.request(
      clientId,
      () => this.#runResync(clientId)
    );

    return true;
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

  #deliver(
    payload: unknown,
    to?: string
  ): void {
    let event: string | undefined;
    if (this.#outbound !== null) {
      const parsed = this.#outbound.parse(payload);
      if (!parsed.ok) {
        this.#logger
          .withMetadata({
            outcome: "dropped",
            reason: describeErrors(parsed.val)
          })
          .error("outbound payload does not match the extension protocol");

        return;
      }
      event = parsed.val.event;
    }

    const envelope = {
      room: this.id,
      kind: "message",
      payload
    } as const;
    if (to === undefined) {
      this.#members.send(envelope, { event });
    }
    else {
      this.#members.sendTo(to, envelope, event);
    }
  }
}
