// Import Third-party Dependencies
import type {
  PeerMetadata,
  Room
} from "@jolly-pixel/network/client";

export type PeerColor = (
  clientId: string,
  profile: PeerMetadata
) => string;

export type PeerLabel = (
  clientId: string,
  profile: PeerMetadata
) => string;

export type PeerStyle = (
  clientId: string
) => string;

export function peerProfile(
  room: Room,
  clientId: string
): PeerMetadata {
  return room.peers.get(clientId)?.profile ?? {};
}

export function peerStyle(
  room: Room,
  style: PeerColor | PeerLabel
): PeerStyle {
  return (clientId) => style(clientId, peerProfile(room, clientId));
}
