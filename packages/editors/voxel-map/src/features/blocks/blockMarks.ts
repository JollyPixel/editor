// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// CONSTANTS
const kMaxDots = 3;
const kSelfFallbackColor = "#5b7fb8";
const kSelfFallbackName = "You";

export interface BlockPeerMark {
  clientId: string;
  displayName: string;
  color: string;
  self?: boolean;
}

export type BlockMarkMap = ReadonlyMap<number, readonly BlockPeerMark[]>;

export interface BlockMarkView {
  highlight: BlockPeerMark;
  dots: readonly BlockPeerMark[];
}

export function resolveBlockMarks(
  marks: readonly BlockPeerMark[] | undefined
): BlockMarkView | null {
  if (marks === undefined || marks.length === 0) {
    return null;
  }

  const [highlight, ...others] = marks;

  return {
    highlight,
    dots: others.slice(0, kMaxDots)
  };
}

export function selfBlockMark(
  peers: Iterable<PresencePeer>
): BlockPeerMark {
  for (const peer of peers) {
    if (peer.self) {
      return {
        clientId: peer.clientId,
        displayName: peer.displayName,
        color: peer.color,
        self: true
      };
    }
  }

  return {
    clientId: "",
    displayName: kSelfFallbackName,
    color: kSelfFallbackColor,
    self: true
  };
}

export function mergeSelfBlockMark(
  peerMarks: BlockMarkMap,
  blockId: number | null,
  local: BlockPeerMark
): BlockMarkMap {
  const merged = new Map<number, BlockPeerMark[]>();
  for (const [id, marks] of peerMarks) {
    merged.set(id, [...marks]);
  }

  if (blockId === null) {
    return merged;
  }

  merged.set(
    blockId,
    [local, ...merged.get(blockId) ?? []]
  );

  return merged;
}

export function blockMarkNames(
  view: BlockMarkView
): string {
  return [view.highlight, ...view.dots]
    .map((mark) => mark.displayName)
    .join(", ");
}
