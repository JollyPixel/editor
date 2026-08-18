export interface PeerColorAllocator {
  /**
   * Deterministic-enough color for `peerId`, stable until `release()`.
   */
  colorOf(
    peerId: string
  ): string;

  /**
   * Called when a peer disconnects (from `PeerSelectionRegistry.removePeer`).
   */
  release(
    peerId: string
  ): void;
}
