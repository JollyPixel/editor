// Import Third-party Dependencies
import type {
  Peer,
  PeerMetadata
} from "@jolly-pixel/network/client";
import { colorFromKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  GUEST_USERNAME,
  type PeerIdentity
} from "../peer/identity.ts";
import type { PresencePeer } from "../peer/Presence.ts";

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

export function readAvatar(
  profile: PeerMetadata | undefined
): string | undefined {
  const avatar = profile?.avatar;

  return typeof avatar === "string" && isSameOriginPath(avatar)
    ? avatar
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

export function presencePeerOf(
  peer: Peer
): PresencePeer {
  return {
    clientId: peer.clientId,
    displayName: readUsername(peer.profile),
    color: peerProfileColor(peer.clientId, peer.profile),
    peerId: readPeerId(peer.profile),
    avatar: readAvatar(peer.profile)
  };
}

function isSameOriginPath(
  value: string
): boolean {
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\");
}
