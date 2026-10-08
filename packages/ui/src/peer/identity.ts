// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// CONSTANTS
export const GUEST_USERNAME = "Guest";

export interface PeerIdentity {
  username: string;
  peerId: string;
  color: string;
}

export function peerIdentity(
  username: string,
  peerId: string = crypto.randomUUID()
): PeerIdentity {
  return {
    username,
    peerId,
    color: colorFromKey(peerId)
  };
}
