// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  match,
  P
} from "ts-pattern";

// Import Internal Dependencies
import { DEFAULT_ROLE } from "../protocol/constants.ts";
import type {
  ClientEnvelope,
  ServerEnvelope
} from "../protocol/envelope/Envelope.ts";
import type { RoomMessageParser } from "../protocol/message/MessageParser.ts";
import type {
  Peer,
  PeerMetadata,
  Right,
  RoomRights
} from "../protocol/types.ts";
import type {
  Room,
  RoomEventMap
} from "./Room.ts";

// CONSTANTS
const kNoRights: RoomRights = Object.freeze({});

type ClientRoomState = "idle" | "joined" | "left";

type ServerEnvelopeOf<TKind extends ServerEnvelope["kind"]> = Extract<
  ServerEnvelope,
  { kind: TKind; }
>;

export interface ClientRoomOptions<TServerMessage> {
  id: string;
  profile: PeerMetadata;
  parser: RoomMessageParser<TServerMessage> | undefined;
  send: (
    envelope: ClientEnvelope
  ) => void;
  onLeave: () => void;
}

function toPeer(
  source: Peer
): Peer {
  return {
    clientId: source.clientId,
    role: source.role,
    profile: source.profile,
    presence: source.presence
  };
}

function withPatch(
  peer: Peer,
  field: "presence" | "profile",
  patch: PeerMetadata
): Peer {
  return {
    ...peer,
    [field]: {
      ...peer[field],
      ...patch
    }
  };
}

export class ClientRoom<
  TClientMessage = unknown,
  TServerMessage = unknown
> extends Emitter<RoomEventMap<TServerMessage>>
  implements Room<TClientMessage, TServerMessage> {
  readonly id: string;

  #state: ClientRoomState = "idle";
  #clientId: string | null = null;
  #self: Peer | null = null;
  #rights = kNoRights;
  #peers = new Map<string, Peer>();
  #presence: PeerMetadata = {};
  #resume: (() => unknown) | null = null;
  #claimedProfile: PeerMetadata;
  #parser: RoomMessageParser<TServerMessage> | undefined;
  #send: (envelope: ClientEnvelope) => void;
  #onLeave: () => void;

  constructor(
    options: ClientRoomOptions<TServerMessage>
  ) {
    super();
    this.id = options.id;
    this.#claimedProfile = options.profile;
    this.#parser = options.parser;
    this.#send = options.send;
    this.#onLeave = options.onLeave;
  }

  get clientId(): string | null {
    return this.#clientId;
  }

  get peers(): ReadonlyMap<string, Peer> {
    return this.#peers;
  }

  get profile(): PeerMetadata | null {
    return this.#self?.profile ?? null;
  }

  get role(): string {
    return this.#self?.role ?? DEFAULT_ROLE;
  }

  get rights(): RoomRights {
    return this.#rights;
  }

  get access(): Right {
    const values = Object.values(this.#rights);
    if (values.includes("write")) {
      return "write";
    }

    return values.includes("read") ? "read" : "void";
  }

  can(
    event: string
  ): Right {
    return this.#rights[event] ?? "void";
  }

  join(): void {
    if (this.#state === "left") {
      throw new Error(
        `Room "${this.id}" was left; get a new handle from client.room().`
      );
    }
    if (this.#state === "joined") {
      return;
    }

    this.#state = "joined";
    this.#sendJoin();
  }

  rejoin(): void {
    if (this.#state === "joined") {
      this.#sendJoin();
    }
  }

  suspend(): void {
    if (this.#state !== "joined") {
      return;
    }

    this.#clientId = null;
    const clientIds = [...this.#peers.keys()];
    this.#peers.clear();
    for (const clientId of clientIds) {
      this.emit("peer-left", {
        clientId
      });
    }
  }

  resumeWith(
    source: (() => unknown) | null
  ): void {
    this.#resume = source;
  }

  send(
    payload: TClientMessage
  ): void {
    this.#send({
      room: this.id,
      kind: "message",
      payload
    });
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.#presence = {
      ...this.#presence,
      ...patch
    };
    if (this.#state === "joined") {
      this.#send({
        room: this.id,
        kind: "presence",
        patch
      });
    }
  }

  resync(): void {
    if (this.#state === "joined") {
      this.#send({
        room: this.id,
        kind: "resync"
      });
    }
  }

  leave(): void {
    if (this.#state === "left") {
      return;
    }
    if (this.#state === "joined") {
      this.#send({
        room: this.id,
        kind: "leave"
      });
    }

    this.#state = "left";
    this.#onLeave();
    this.#peers.clear();
    this.#clientId = null;
    this.#self = null;
    this.#rights = kNoRights;
    this.emit("left");
  }

  receive(
    envelope: ServerEnvelope
  ): void {
    match(envelope)
      .with({ kind: "message" }, (envelope) => this.#receiveMessage(envelope.payload))
      .with({ kind: "sync" }, (envelope) => this.#admit(envelope))
      .with({ kind: "peer-joined" }, (envelope) => this.#addPeer(envelope))
      .with({ kind: "peer-left" }, (envelope) => this.#removePeer(envelope.clientId))
      .with({ kind: "peer-presence" }, (envelope) => this.#patchMember(envelope, "presence"))
      .with({ kind: "peer-profile" }, (envelope) => this.#patchMember(envelope, "profile"))
      .with({ kind: P.union("denied", "error") }, (envelope) => this.emit(envelope.kind, {
        event: envelope.event,
        reason: envelope.reason
      }))
      .exhaustive();
  }

  #sendJoin(): void {
    const resume = this.#resume?.();

    this.#send({
      room: this.id,
      kind: "join",
      profile: this.#claimedProfile,
      presence: { ...this.#presence },
      ...(resume === undefined ? {} : { resume })
    });
  }

  #receiveMessage(
    payload: unknown
  ): void {
    if (this.#parser === undefined) {
      this.emit("message", payload as TServerMessage);

      return;
    }

    this.#parser.parse(payload)
      .andTee((parsed) => this.emit("message", parsed.message))
      .orTee((errors) => this.emit("malformed", {
        payload,
        errors
      }));
  }

  #admit(
    envelope: ServerEnvelopeOf<"sync">
  ): void {
    this.#clientId = envelope.self;
    this.#rights = envelope.rights;
    this.#self = null;
    this.#peers.clear();

    const clientIds: string[] = [];
    for (const member of envelope.members) {
      if (member.clientId === envelope.self) {
        this.#self = toPeer(member);
      }
      else {
        this.#peers.set(member.clientId, toPeer(member));
        clientIds.push(member.clientId);
      }
    }

    this.emit("sync", {
      self: envelope.self,
      clientIds
    });
  }

  #addPeer(
    envelope: ServerEnvelopeOf<"peer-joined">
  ): void {
    this.#peers.set(envelope.clientId, toPeer(envelope));
    this.emit("peer-joined", {
      clientId: envelope.clientId
    });
  }

  #removePeer(
    clientId: string
  ): void {
    this.#peers.delete(clientId);
    this.emit("peer-left", {
      clientId
    });
  }

  #patchMember(
    envelope: ServerEnvelopeOf<"peer-presence" | "peer-profile">,
    field: "presence" | "profile"
  ): void {
    const { kind, clientId, patch } = envelope;
    const peer = this.#peers.get(clientId);
    if (peer !== undefined) {
      this.#peers.set(clientId, withPatch(peer, field, patch));
    }
    else if (clientId === this.#clientId && this.#self !== null) {
      this.#self = withPatch(this.#self, field, patch);
    }

    this.emit(kind, {
      clientId,
      patch
    });
  }
}
