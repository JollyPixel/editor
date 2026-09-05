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

export interface PeerSelectionChangeEventDetail {
  peerId: string;
  objectId: string | null;
  previousObjectId: string | null;
}

export interface PeerSelectionRegistryEventMap {
  peerSelectionChange: CustomEvent<PeerSelectionChangeEventDetail>;
}

export interface PeerSelectionRegistry {
  addEventListener<K extends keyof PeerSelectionRegistryEventMap>(
    type: K,
    listener: (event: PeerSelectionRegistryEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<K extends keyof PeerSelectionRegistryEventMap>(
    type: K,
    listener: (event: PeerSelectionRegistryEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;
}

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

  selectorsOf(
    objectId: string
  ): readonly string[] {
    return (this.#objectToPeers.get(objectId) ?? []).slice();
  }

  selectedObjectIds(): readonly string[] {
    return Array.from(this.#objectToPeers.keys());
  }

  primarySelectorOf(
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
