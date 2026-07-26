// Import Internal Dependencies
import type {
  PeerMetadata,
  Peer
} from "../types.ts";

export interface RoomPeerEventDetail {
  clientId: string;
}

export interface RoomPeerPresenceEventDetail extends RoomPeerEventDetail {
  patch: PeerMetadata;
}

export interface RoomEventMap<ServerMessage = unknown> {
  message: CustomEvent<ServerMessage>;
  "peer-joined": CustomEvent<RoomPeerEventDetail>;
  "peer-left": CustomEvent<RoomPeerEventDetail>;
  "peer-presence": CustomEvent<RoomPeerPresenceEventDetail>;
}

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

  addEventListener<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: (event: RoomEventMap<ServerMessage>[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: (event: RoomEventMap<ServerMessage>[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
}
