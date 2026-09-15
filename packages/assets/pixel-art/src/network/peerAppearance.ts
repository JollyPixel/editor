// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";
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
) => string | undefined;

export function defaultPeerColor(
  clientId: string
): string {
  return colorFromKey(clientId);
}

export function defaultPeerLabel(
  _clientId: string,
  profile: PeerMetadata
): string | undefined {
  return typeof profile.username === "string" ? profile.username : undefined;
}

export function peerProfile(
  room: Room,
  clientId: string
): PeerMetadata {
  return room.peers.get(clientId)?.profile ?? {};
}
