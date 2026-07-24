// Import Internal Dependencies
import type { PeerMetadata } from "./types.ts";

export type NetworkChannelMessageListener<ServerPayload = unknown> = (
  payload: ServerPayload
) => void;

export type NetworkChannelPeerListener = (
  clientId: string
) => void;

export type NetworkChannelPeerMetadataListener = (
  clientId: string,
  patch: PeerMetadata
) => void;

export interface NetworkPeer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}

export interface NetworkChannel<
  ClientPayload = unknown,
  ServerPayload = unknown
> {
  readonly namespace: string;
  readonly localClientId: string;
  readonly peers: ReadonlyMap<string, NetworkPeer>;

  send(
    payload: ClientPayload
  ): void;
  updatePresence(
    patch: PeerMetadata
  ): void;
  leave(): void;

  onMessage: NetworkChannelMessageListener<ServerPayload> | null;
  onPeerJoined: NetworkChannelPeerListener | null;
  onPeerLeft: NetworkChannelPeerListener | null;
  onPeerPresence: NetworkChannelPeerMetadataListener | null;
}
