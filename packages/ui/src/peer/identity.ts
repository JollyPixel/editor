// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";

// CONSTANTS
export const GUEST_USERNAME = "Guest";

export interface PeerIdentity {
  username: string;
  peerId: string;
  color: string;
  /**
   * Same-origin path of an uploaded avatar image.
   */
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
    color: colorFromKey(peerId),
    ...(avatar === undefined ? {} : { avatar })
  };
}
