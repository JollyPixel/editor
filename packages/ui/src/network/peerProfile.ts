// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network/client";
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  GUEST_USERNAME,
  type PeerIdentity
} from "../peer/identity.ts";

export function toPeerMetadata(
  identity: PeerIdentity
): PeerMetadata {
  return {
    username: identity.username,
    peerId: identity.peerId
  };
}

export function readUsername(
  profile: PeerMetadata | undefined
): string {
  return typeof profile?.username === "string"
    ? profile.username
    : GUEST_USERNAME;
}

export function readPeerId(
  profile: PeerMetadata | undefined
): string | undefined {
  return typeof profile?.peerId === "string"
    ? profile.peerId
    : undefined;
}

export function peerProfileColor(
  clientId: string,
  profile: PeerMetadata | undefined
): string {
  return colorFromKey(
    readPeerId(profile) ?? clientId
  );
}
