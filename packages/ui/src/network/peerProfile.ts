// Import Third-party Dependencies
import {
  parsePeerProfile,
  type PeerMetadata,
  type PeerProfile,
  type PeerProfileMetadata,
  type Room
} from "@jolly-pixel/network/client";
import { ColorSequence } from "@jolly-pixel/color";

// Import Internal Dependencies
import type { PeerIdentity } from "../peer/identity.ts";
import type { PresencePeer } from "../peer/types.ts";

interface RoomMember {
  clientId: string;
  profile?: PeerMetadata;
}

export interface PeerProfileOptions {
  /**
   * Joins as an observer, which collaborator lists leave out.
   * @default false
   */
  observer?: boolean;
}

export function toPeerProfileMetadata(
  identity: PeerIdentity,
  options: PeerProfileOptions = {}
): PeerProfileMetadata {
  const profile: PeerProfileMetadata = {
    username: identity.username,
    peerId: identity.peerId
  };

  return options.observer === true ?
    {
      ...profile,
      observer: true
    } :
    profile;
}

export function* collaborators<TMember extends RoomMember>(
  members: Iterable<TMember>
): IterableIterator<TMember> {
  for (const member of members) {
    if (parsePeerProfile(member.profile).observer !== true) {
      yield member;
    }
  }
}

export function peerProfileColor(
  clientId: string,
  profile: PeerMetadata | undefined
): string {
  return profileColor(clientId, parsePeerProfile(profile));
}

export function toPresencePeer(
  member: RoomMember
): PresencePeer {
  const profile = parsePeerProfile(member.profile);

  return {
    clientId: member.clientId,
    displayName: profile.username,
    color: profileColor(member.clientId, profile),
    peerId: profile.peerId,
    avatar: profile.avatar,
    ...(profile.via === undefined ? {} : { badge: `via ${profile.via}` })
  };
}

export function localPresencePeer(
  room: Pick<Room, "clientId" | "profile">
): PresencePeer {
  return {
    ...toPresencePeer({
      clientId: room.clientId ?? "",
      profile: room.profile
    }),
    self: true
  };
}

function profileColor(
  clientId: string,
  profile: PeerProfile
): string {
  return ColorSequence.default.pick(profile.peerId ?? clientId);
}
