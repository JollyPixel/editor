// Import Internal Dependencies
import type { RoomMessageParser } from "../protocol/MessageParser.ts";
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

export interface RoomDeniedEvent {
  event: string;
  reason: string;
}

export interface RoomErrorEvent {
  event: string;
  reason: string;
}

export interface RoomMalformedEvent {
  payload: unknown;
  errors: readonly ValidationError[];
}

export interface RoomOptions<ServerMessage = unknown> {
  parser?: RoomMessageParser<ServerMessage>;
}

export type RoomEventMap<ServerMessage = unknown> = {
  message: (payload: ServerMessage) => void;
  sync: (event: RoomSyncEvent) => void;
  "peer-joined": (event: RoomPeerEvent) => void;
  "peer-left": (event: RoomPeerEvent) => void;
  "peer-presence": (event: RoomPeerPresenceEvent) => void;
  denied: (event: RoomDeniedEvent) => void;
  error: (event: RoomErrorEvent) => void;
  malformed: (event: RoomMalformedEvent) => void;
};

export interface Room<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;
  readonly role: string;
  readonly rights: RoomRights;
  readonly access: Right;

  can(
    event: string
  ): Right;
  join(): void;
  send(
    payload: ClientMessage
  ): void;
  updatePresence(
    patch: PeerMetadata
  ): void;
  leave(): void;

  on<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void;
  off<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void;
}
