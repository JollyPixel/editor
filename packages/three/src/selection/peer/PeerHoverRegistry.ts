// Import Internal Dependencies
import type { PeerColorAllocator } from "./PeerColorAllocator.ts";

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

export interface PeerHoverRegistryOptions {
  /**
   * @default a stateless hash-based allocator over a built-in 8-color palette
   */
  colorAllocator?: PeerColorAllocator;
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

/**
 * Stateless, coordination-free fallback - same default
 * `PeerSelectionRegistry` uses. Sharing the same hash function and palette
 * means a peer's hover color agrees with `PeerSelectionRegistry`'s default
 * `colorOf` without either registry knowing about the other. A caller that
 * injects a custom `colorAllocator` into `PeerSelectionRegistry` should
 * pass that same instance here too, to keep selection and hover in sync.
 */
function createDefaultColorAllocator(): PeerColorAllocator {
  return {
    colorOf: (peerId) => kDefaultColors[hash(peerId) % kDefaultColors.length],
    // Stateless, nothing to free.
    release: () => void 0
  };
}

export interface PeerHoverChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}

/**
 * Tracks which remote peers currently hover which object - the hover
 * counterpart to `PeerSelectionRegistry`, kept as its own class for the
 * same reason that one is separate from `SelectionManager`.
 *
 * Same oldest-first bookkeeping as `PeerSelectionRegistry.selectorsOf`/
 * `primarySelectorOf`: `hoverersOf` keeps hoverers in the order they
 * started hovering, so `primaryHovererOf` can resolve a single
 * deterministic "whoever hovered it first" peer.
 */
export class PeerHoverRegistry extends EventTarget {
  #peerToObject = new Map<string, string>();
  #objectToPeers = new Map<string, string[]>();
  #colorAllocator: PeerColorAllocator;

  constructor(
    options: PeerHoverRegistryOptions = {}
  ) {
    super();

    this.#colorAllocator = options.colorAllocator ?? createDefaultColorAllocator();
  }

  /**
   * Moves `peerId`'s hover to `objectId` (or clears it, for `null`),
   * removing it from whatever object it previously hovered. No-ops (and
   * does not dispatch) if `objectId` already is `peerId`'s hover.
   */
  hover(
    peerId: string,
    objectId: string | null
  ): void {
    const previousObjectId = this.#peerToObject.get(peerId) ?? null;
    if (objectId === previousObjectId) {
      return;
    }

    if (previousObjectId !== null) {
      this.#removeFromObject(previousObjectId, peerId);
    }

    if (objectId === null) {
      this.#peerToObject.delete(peerId);
    }
    else {
      this.#peerToObject.set(peerId, objectId);
      const peers = this.#objectToPeers.get(objectId);
      if (peers) {
        peers.push(peerId);
      }
      else {
        this.#objectToPeers.set(objectId, [peerId]);
      }
    }

    this.dispatchEvent(
      new CustomEvent<PeerHoverChangeEventDetail>("peerHoverChange", {
        detail: { peerId, objectId, previousObjectId }
      })
    );
  }

  /**
   * Clears `peerId`'s hover entirely, as if it hovered `null`. Use this when
   * a peer disconnects - the single point where `colorAllocator` learns a
   * peer is actually gone (see `dispose`, which deliberately does not
   * release colors).
   */
  removePeer(
    peerId: string
  ): void {
    this.hover(peerId, null);
    this.#colorAllocator.release(peerId);
  }

  hoverOf(
    peerId: string
  ): string | null {
    return this.#peerToObject.get(peerId) ?? null;
  }

  /**
   * Every peer currently hovering `objectId`, oldest-first.
   */
  hoverersOf(
    objectId: string
  ): readonly string[] {
    return (this.#objectToPeers.get(objectId) ?? []).slice();
  }

  /**
   * Every object id with at least one current hoverer, in no particular
   * order. Lets a caller (e.g. `PeerHighlightPass`) enumerate every
   * currently-hovered object without tracking that set itself.
   */
  hoveredObjectIds(): readonly string[] {
    return Array.from(this.#objectToPeers.keys());
  }

  /**
   * The peer that has hovered `objectId` the longest, or `null` if none has.
   * This is the peer whose color a single 3D indicator should use.
   */
  primaryHovererOf(
    objectId: string
  ): string | null {
    return this.#objectToPeers.get(objectId)?.[0] ?? null;
  }

  /**
   * Deterministic color for `peerId`, stable across calls.
   */
  colorOf(
    peerId: string
  ): string {
    return this.#colorAllocator.colorOf(peerId);
  }

  /**
   * Forgets every peer and object. Does not dispatch `peerHoverChange` for
   * the state it clears, and does not release colors either - same
   * reasoning as `PeerSelectionRegistry.dispose`.
   */
  dispose(): void {
    this.#peerToObject.clear();
    this.#objectToPeers.clear();
  }

  #removeFromObject(
    objectId: string,
    peerId: string
  ): void {
    const peers = this.#objectToPeers.get(objectId);
    if (!peers) {
      return;
    }

    const index = peers.indexOf(peerId);
    if (index !== -1) {
      peers.splice(index, 1);
    }

    if (peers.length === 0) {
      this.#objectToPeers.delete(objectId);
    }
  }
}
