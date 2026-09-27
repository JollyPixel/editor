// Import Internal Dependencies
import type { RoomMessageParser } from "../protocol/message/MessageParser.ts";
import type { ValidationError } from "../protocol/schema.ts";
import type {
  PeerMetadata,
  Peer,
  Right,
  RoomRights
} from "../protocol/types.ts";

export interface RoomPeerEvent {
  clientId: string;
}

export interface RoomPeerPresenceEvent extends RoomPeerEvent {
  patch: PeerMetadata;
}

export interface RoomSyncEvent {
  self: string;
  clientIds: string[];
}

export interface RoomRejectionEvent {
  event: string;
  reason: string;
}

export interface RoomMalformedEvent {
  payload: unknown;
  errors: readonly ValidationError[];
}

export interface RoomOptions<TServerMessage = unknown> {
  parser?: RoomMessageParser<TServerMessage>;
}

export type RoomEventMap<TServerMessage = unknown> = {
  message: (
    payload: TServerMessage
  ) => void;
  sync: (
    event: RoomSyncEvent
  ) => void;
  "peer-joined": (
    event: RoomPeerEvent
  ) => void;
  "peer-left": (
    event: RoomPeerEvent
  ) => void;
  "peer-presence": (
    event: RoomPeerPresenceEvent
  ) => void;
  denied: (
    event: RoomRejectionEvent
  ) => void;
  error: (
    event: RoomRejectionEvent
  ) => void;
  malformed: (
    event: RoomMalformedEvent
  ) => void;
  left: () => void;
};

export interface Room<
  TClientMessage = unknown,
  TServerMessage = unknown
> {
  readonly id: string;
  readonly clientId: string | null;
  readonly peers: ReadonlyMap<string, Peer>;
  readonly role: string;
  readonly rights: RoomRights;
  readonly access: Right;

  can(
    event: string
  ): Right;
  join(): void;
  send(
    payload: TClientMessage
  ): void;
  updatePresence(
    patch: PeerMetadata
  ): void;
  leave(): void;

  on<K extends keyof RoomEventMap<TServerMessage>>(
    type: K,
    listener: RoomEventMap<TServerMessage>[K]
  ): void;
  off<K extends keyof RoomEventMap<TServerMessage>>(
    type: K,
    listener: RoomEventMap<TServerMessage>[K]
  ): void;
}
