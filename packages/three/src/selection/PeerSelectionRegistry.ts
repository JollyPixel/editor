// Import Internal Dependencies
import { ColorPalette } from "./ColorPalette.ts";

export interface PeerSelectionRegistryOptions {
  /**
   * @default a built-in 8-color palette
   */
  colors?: string[];
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
  #palette: ColorPalette;

  constructor(
    options: PeerSelectionRegistryOptions = {}
  ) {
    super();

    this.#palette = new ColorPalette({ colors: options.colors });
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
   * when a peer disconnects.
   */
  removePeer(
    peerId: string
  ): void {
    this.select(peerId, null);
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
   * order. Lets a caller (e.g. `PeerColoredOutline`) enumerate every
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
    return this.#palette.forKey(peerId);
  }

  /**
   * Forgets every peer and object. Does not dispatch `peerSelectionChange`
   * for the state it clears - consumers tearing this down should stop
   * listening rather than react to a flood of removal events.
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
