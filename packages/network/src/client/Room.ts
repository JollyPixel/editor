// Import Internal Dependencies
import type {
  PeerMetadata,
  Peer
} from "../types.ts";

export interface RoomPeerEvent {
  clientId: string;
}

export interface RoomPeerPresenceEvent extends RoomPeerEvent {
  patch: PeerMetadata;
}

export interface RoomDeniedEvent {
  event: string;
  reason: string;
}

export type RoomEventMap<ServerMessage = unknown> = {
  message: (payload: ServerMessage) => void;
  "peer-joined": (event: RoomPeerEvent) => void;
  "peer-left": (event: RoomPeerEvent) => void;
  "peer-presence": (event: RoomPeerPresenceEvent) => void;
  denied: (event: RoomDeniedEvent) => void;
};

export interface Room<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;

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
