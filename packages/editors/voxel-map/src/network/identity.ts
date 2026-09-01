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
  identity: network.PeerMetadata | undefined
): string {
  return typeof identity?.username === "string" ?
    identity.username :
    kFallbackUsername;
}

export function readPeerId(
  identity: network.PeerMetadata | undefined
): string | undefined {
  return typeof identity?.peerId === "string" ? identity.peerId : undefined;
}

export function peerColor(
  clientId: string,
  identity: network.PeerMetadata | undefined
): string {
  return colorFromKey(readPeerId(identity) ?? clientId);
}
