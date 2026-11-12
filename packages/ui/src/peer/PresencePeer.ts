export interface PresencePeer {
  clientId: string;
  displayName: string;
  /**
   * CSS color for this peer.
   */
  color: string;
  self?: boolean;
  /**
   * Picks the default avatar. Defaults to `clientId`.
   */
  peerId?: string;
  /**
   * Image URL of an uploaded avatar.
   */
  avatar?: string;
  /**
   * Short label shown after the name, such as "via link".
   */
  badge?: string;
  /**
   * What the peer says it is doing, such as "Placing 12 trees · 40%".
   */
  activity?: string;
}

export function samePeer(
  left: PresencePeer,
  right: PresencePeer
): boolean {
  return left === right || (
    left.clientId === right.clientId &&
    left.displayName === right.displayName &&
    left.color === right.color &&
    left.self === right.self &&
    left.peerId === right.peerId &&
    left.avatar === right.avatar &&
    left.badge === right.badge &&
    left.activity === right.activity
  );
}

export function samePeers(
  left: readonly PresencePeer[],
  right: readonly PresencePeer[]
): boolean {
  return left === right || (
    left.length === right.length &&
    left.every((peer, index) => samePeer(peer, right[index]))
  );
}
