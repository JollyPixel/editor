// Import Third-party Dependencies
import {
  parsePeerActivity,
  parsePeerProfile,
  type PeerActivity,
  type PeerMetadata,
  type PeerProfile,
  type PeerProfileMetadata,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PeerIdentity } from "../peer/identity/PeerIdentity.ts";
import type { PeerMark } from "../peer/PeerMarks.ts";
import { peerColor } from "../peer/peerColor.ts";
import { compareClientIds } from "../peer/peerOrder.ts";
import type { PresencePeer } from "../peer/PresencePeer.ts";

interface RoomMember {
  clientId: string;
  profile?: PeerMetadata;
  presence?: PeerMetadata;
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

export function peerProfileColor(
  clientId: string,
  profile: PeerMetadata | undefined
): string {
  return profileColor(clientId, parsePeerProfile(profile));
}

export function formatPeerActivity(
  activity: PeerActivity
): string {
  return activity.progress === undefined ?
    activity.label :
    `${activity.label} · ${Math.round(activity.progress * 100)}%`;
}

export function peerActivityLabel(
  presence: PeerMetadata | undefined
): string | undefined {
  const activity = parsePeerActivity(presence);

  return activity === null ? undefined : formatPeerActivity(activity);
}

export function toPresencePeer(
  member: RoomMember
): PresencePeer {
  const profile = parsePeerProfile(member.profile);
  const activity = peerActivityLabel(member.presence);

  return {
    clientId: member.clientId,
    displayName: profile.username,
    color: profileColor(member.clientId, profile),
    peerId: profile.peerId,
    avatar: profile.avatar,
    ...(profile.via === undefined ? {} : { badge: `via ${profile.via}` }),
    ...(activity === undefined ? {} : { activity })
  };
}

export function remotePeers(
  room: Pick<Room, "peers">
): PresencePeer[] {
  const peers: PresencePeer[] = [];
  for (const member of room.peers.values()) {
    if (parsePeerProfile(member.profile).observer !== true) {
      peers.push(toPresencePeer(member));
    }
  }

  return peers.sort(
    (left, right) => compareClientIds(left.clientId, right.clientId)
  );
}

export function roomPeers(
  room: Pick<Room, "clientId" | "profile" | "peers">
): PresencePeer[] {
  const local: PresencePeer = {
    ...toPresencePeer({
      clientId: room.clientId ?? "",
      profile: room.profile
    }),
    self: true
  };

  return [local, ...remotePeers(room)];
}

export function markedPeers<TValue>(
  room: Pick<Room, "peers">,
  values: ReadonlyMap<string, TValue | null>
): PeerMark<TValue>[] {
  const marks: PeerMark<TValue>[] = [];
  for (const peer of remotePeers(room)) {
    const value = values.get(peer.clientId);
    if (value !== undefined && value !== null) {
      marks.push([peer, value]);
    }
  }

  return marks;
}

function profileColor(
  clientId: string,
  profile: PeerProfile
): string {
  return peerColor(profile.peerId ?? clientId);
}
