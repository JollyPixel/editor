// Import Third-party Dependencies
import type { AnimationClipJSON } from "@jolly-pixel/asset.voxel-animation/client";
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  ClipKey,
  PeerAnimateCursor
} from "../../../state/index.ts";
import { keyId } from "./timelineKeys.ts";

export interface TimelinePeer {
  peer: PresencePeer;
  tick: number;
}

export interface TimelinePeers {
  /**
   * Peers on the same clip whose playhead is within it.
   */
  peers: TimelinePeer[];
  /**
   * The color of the first peer who selected each `keyId`.
   */
  peerKeys: ReadonlyMap<string, string>;
}

export function timelinePeers(
  cursors: readonly PeerAnimateCursor[],
  key: ClipKey,
  clip: AnimationClipJSON
): TimelinePeers {
  const peers: TimelinePeer[] = [];
  const peerKeys = new Map<string, string>();
  for (const { peer, cursor } of cursors) {
    if (cursor.clip !== key) {
      continue;
    }
    if (cursor.tick <= clip.length) {
      peers.push({ peer, tick: cursor.tick });
    }
    for (const id of cursor.keys.map(keyId)) {
      if (!peerKeys.has(id)) {
        peerKeys.set(id, peer.color);
      }
    }
  }

  return { peers, peerKeys };
}
