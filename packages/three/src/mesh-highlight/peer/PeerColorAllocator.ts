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

export interface PeerColorAllocator {
  colorOf(
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
    colorOf: (peerId) => kDefaultColors[hash(peerId) % kDefaultColors.length],
    release: () => void 0
  };
}
