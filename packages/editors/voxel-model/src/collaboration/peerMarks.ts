// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// CONSTANTS
const kMaxDots = 3;
const kSelfFallbackColor = "#5b7fb8";
const kSelfFallbackName = "You";

export interface PeerMark {
  clientId: string;
  displayName: string;
  color: string;
  self?: boolean;
}

export type PeerMarkMap<TKey> = ReadonlyMap<TKey, readonly PeerMark[]>;

export interface PeerMarkView {
  highlight: PeerMark;
  dots: readonly PeerMark[];
}

export function resolvePeerMarks(
  marks: readonly PeerMark[] | undefined
): PeerMarkView | null {
  if (marks === undefined || marks.length === 0) {
    return null;
  }

  const [highlight, ...others] = marks;

  return {
    highlight,
    dots: others.slice(0, kMaxDots)
  };
}

export function selfPeerMark(
  peers: Iterable<PresencePeer>
): PeerMark {
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

export function mergeSelfPeerMark<TKey>(
  peerMarks: PeerMarkMap<TKey>,
  key: TKey | null,
  local: PeerMark
): PeerMarkMap<TKey> {
  const merged = new Map<TKey, PeerMark[]>();
  for (const [id, marks] of peerMarks) {
    merged.set(id, [...marks]);
  }

  if (key === null) {
    return merged;
  }

  merged.set(
    key,
    [local, ...merged.get(key) ?? []]
  );

  return merged;
}

export function peerMarkNames(
  view: PeerMarkView
): string {
  return [view.highlight, ...view.dots]
    .map((mark) => mark.displayName)
    .join(", ");
}
