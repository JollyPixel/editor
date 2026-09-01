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

export interface PeerSelectionRegistryOptions {
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
 * Stateless, coordination-free fallback: any two `PeerSelectionRegistry`
 * instances resolve the same peer id to the same color without sharing
 * state, which is what lets each editor own an independent registry by
 * default. A caller that wants collision-free/reclaimable colors across a
 * larger or shared peer roster injects its own `colorAllocator` instead
 * (see `examples/scripts/network/PeerColorPaletteAllocator.ts`).
 */
function createDefaultColorAllocator(): PeerColorAllocator {
  return {
    colorOf: (peerId) => kDefaultColors[hash(peerId) % kDefaultColors.length],
    // Stateless, nothing to free.
    release: () => void 0
  };
}

export interface PeerSelectionChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}

/**
 * Tracks which remote peers currently have which object selected - purely
 * bookkeeping, transport-agnostic (no `THREE` objects, no network types), so
 * it can be driven directly by fake peers in a demo today and by real
 * `@jolly-pixel/network` presence events later without changing this class.
 *
 * Deliberately separate from `SelectionManager`, which is single-local-user
 * state (one `selected`, one `hovered`): this registry only ever holds
 * *remote* peers. The local user's own selection is not represented here.
 *
 * For each object, selectors are kept oldest-first so `primarySelectorOf`
 * can resolve a single deterministic "whoever selected it first" peer - the
 * one whose color a 3D viewport should render, instead of one overlay per
 * peer per object.
 */
export class PeerSelectionRegistry extends EventTarget {
  #peerToObject = new Map<string, string>();
  #objectToPeers = new Map<string, string[]>();
  #colorAllocator: PeerColorAllocator;

  constructor(
    options: PeerSelectionRegistryOptions = {}
  ) {
    super();

    this.#colorAllocator = options.colorAllocator ?? createDefaultColorAllocator();
  }

  /**
   * Moves `peerId`'s selection to `objectId` (or clears it, for `null`),
   * removing it from whatever object it previously selected. No-ops (and
   * does not dispatch) if `objectId` already is `peerId`'s selection.
   */
  select(
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
      new CustomEvent<PeerSelectionChangeEventDetail>("peerSelectionChange", {
        detail: { peerId, objectId, previousObjectId }
      })
    );
  }

  /**
   * Clears `peerId`'s selection entirely, as if it selected `null`. Use this
   * when a peer disconnects - the single point where `colorAllocator` learns
   * a peer is actually gone (see `dispose`, which deliberately does not
   * release colors).
   */
  removePeer(
    peerId: string
  ): void {
    this.select(peerId, null);
    this.#colorAllocator.release(peerId);
  }

  selectionOf(
    peerId: string
  ): string | null {
    return this.#peerToObject.get(peerId) ?? null;
  }

  /**
   * Every peer currently selecting `objectId`, oldest-first.
   */
  selectorsOf(
    objectId: string
  ): readonly string[] {
    return (this.#objectToPeers.get(objectId) ?? []).slice();
  }

  /**
   * Every object id with at least one current selector, in no particular
   * order. Lets a caller (e.g. `PeerHighlightPass`) enumerate every
   * currently-selected object without tracking that set itself.
   */
  selectedObjectIds(): readonly string[] {
    return Array.from(this.#objectToPeers.keys());
  }

  /**
   * The peer that has selected `objectId` the longest, or `null` if none
   * has. This is the peer whose color a single 3D overlay should use.
   */
  primarySelectorOf(
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
   * Forgets every peer and object. Does not dispatch `peerSelectionChange`
   * for the state it clears - consumers tearing this down should stop
   * listening rather than react to a flood of removal events. Does not call
   * `colorAllocator.release` either: disposing this registry (e.g. an editor
   * closing) is not the same as every peer disconnecting, especially when
   * `colorAllocator` is shared across several editors' registries in the
   * same collaborative session.
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
