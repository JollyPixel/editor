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
   * @default hash-based allocation from an 8-color palette
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

function createDefaultColorAllocator(): PeerColorAllocator {
  return {
    colorOf: (peerId) => kDefaultColors[hash(peerId) % kDefaultColors.length],
    release: () => void 0
  };
}

export interface PeerHoverChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}

export interface PeerHoverRegistryEventMap {
  peerHoverChange: CustomEvent<PeerHoverChangeEventDetail>;
}

export interface PeerHoverRegistry {
  addEventListener<K extends keyof PeerHoverRegistryEventMap>(
    type: K,
    listener: (event: PeerHoverRegistryEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<K extends keyof PeerHoverRegistryEventMap>(
    type: K,
    listener: (event: PeerHoverRegistryEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;
}

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

  hoverersOf(
    objectId: string
  ): readonly string[] {
    return (this.#objectToPeers.get(objectId) ?? []).slice();
  }

  hoveredObjectIds(): readonly string[] {
    return Array.from(this.#objectToPeers.keys());
  }

  primaryHovererOf(
    objectId: string
  ): string | null {
    return this.#objectToPeers.get(objectId)?.[0] ?? null;
  }

  colorOf(
    peerId: string
  ): string {
    return this.#colorAllocator.colorOf(peerId);
  }

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
