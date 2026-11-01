// CONSTANTS
const kDefaultColors = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1"
];
const kListedFallbackColor = "#ffffff";

export interface ListedPeerColor {
  clientId: string;
  color: string;
}

export interface PeerColorAllocator {
  peerColor(
    peerId: string
  ): string;
  release(
    peerId: string
  ): void;
}

function hash(
  value: string
): number {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }

  return Math.abs(result);
}

export function createDefaultColorAllocator(): PeerColorAllocator {
  return {
    peerColor: (peerId) => kDefaultColors[hash(peerId) % kDefaultColors.length],
    release: () => void 0
  };
}

export function createListedColorAllocator(
  peers: () => readonly ListedPeerColor[]
): PeerColorAllocator {
  return {
    peerColor: (peerId) => peers()
      .find((peer) => peer.clientId === peerId)?.color ?? kListedFallbackColor,
    release: () => void 0
  };
}
