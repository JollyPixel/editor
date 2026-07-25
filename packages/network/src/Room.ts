// Import Internal Dependencies
import type {
  PeerMetadata,
  Peer
} from "./types.ts";

export type RoomMessageListener<ServerMessage = unknown> = (
  payload: ServerMessage
) => void;

export type RoomPeerListener = (
  clientId: string
) => void;

export type RoomPeerMetadataListener = (
  clientId: string,
  patch: PeerMetadata
) => void;

export interface Room<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;

  send(
    payload: ClientMessage
  ): void;
  updatePresence(
    patch: PeerMetadata
  ): void;
  leave(): void;

  onMessage: RoomMessageListener<ServerMessage> | null;
  onPeerJoined: RoomPeerListener | null;
  onPeerLeft: RoomPeerListener | null;
  onPeerPresence: RoomPeerMetadataListener | null;
}
