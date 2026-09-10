// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";
import type * as network from "@jolly-pixel/network";

// CONSTANTS
const kFallbackUsername = "Guest";

export interface EditorIdentity {
  username: string;
  peerId: string;
  color: string;
}

export function toPeerMetadata(
  identity: EditorIdentity
): network.PeerMetadata {
  return {
    username: identity.username,
    peerId: identity.peerId
  };
}

export function readUsername(
  profile: network.PeerMetadata | undefined
): string {
  return typeof profile?.username === "string"
    ? profile.username
    : kFallbackUsername;
}

export function readPeerId(
  profile: network.PeerMetadata | undefined
): string | undefined {
  return typeof profile?.peerId === "string"
    ? profile.peerId
    : undefined;
}

export function peerColor(
  clientId: string,
  profile: network.PeerMetadata | undefined
): string {
  return colorFromKey(
    readPeerId(profile) ?? clientId
  );
}
