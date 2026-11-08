// Import Internal Dependencies
import { peerColor } from "../peerColor.ts";

// CONSTANTS
export const GUEST_USERNAME = "Guest";

export interface PeerIdentity {
  username: string;
  peerId: string;
  color: string;
  avatar?: string;
}

export function peerIdentity(
  username: string,
  peerId: string = crypto.randomUUID(),
  avatar?: string
): PeerIdentity {
  return {
    username,
    peerId,
    color: peerColor(peerId),
    ...(avatar === undefined ? {} : { avatar })
  };
}
