export interface PeerColorAllocator {
  colorOf(
    peerId: string
  ): string;
  release(
    peerId: string
  ): void;
}
