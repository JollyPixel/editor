// Import Internal Dependencies
import {
  createDefaultColorAllocator,
  type PeerColorAllocator
} from "./PeerColorAllocator.ts";
import { PeerMarkIndex } from "./PeerMarkIndex.ts";

export type HighlightIndicatorRole = "selection" | "hover";

export interface PeerHighlightsOptions {
  /**
   * @default hash-based allocation from an 8-color palette
   */
  colorAllocator?: PeerColorAllocator;
}

export interface PeerHighlightChangeEventDetail {
  peerId: string;
  role: HighlightIndicatorRole;
  objectId: string | null;
  previousObjectId: string | null;
}

export interface PeerHighlightsEventMap {
  change: CustomEvent<PeerHighlightChangeEventDetail>;
}

export interface PeerHighlights {
  addEventListener<TKey extends keyof PeerHighlightsEventMap>(
    type: TKey,
    listener: (event: PeerHighlightsEventMap[TKey]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<TKey extends keyof PeerHighlightsEventMap>(
    type: TKey,
    listener: (event: PeerHighlightsEventMap[TKey]) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;
}

export class PeerHighlights extends EventTarget {
  #marks: Record<HighlightIndicatorRole, PeerMarkIndex> = {
    selection: new PeerMarkIndex(),
    hover: new PeerMarkIndex()
  };
  #colorAllocator: PeerColorAllocator;

  constructor(
    options: PeerHighlightsOptions = {}
  ) {
    super();
    this.#colorAllocator = options.colorAllocator ?? createDefaultColorAllocator();
  }

  select(
    peerId: string,
    objectId: string | null
  ): void {
    this.mark("selection", peerId, objectId);
  }

  hover(
    peerId: string,
    objectId: string | null
  ): void {
    this.mark("hover", peerId, objectId);
  }

  mark(
    role: HighlightIndicatorRole,
    peerId: string,
    objectId: string | null
  ): void {
    const index = this.#marks[role];
    const previousObjectId = index.markedObject(peerId);
    if (objectId === previousObjectId) {
      return;
    }

    index.mark(peerId, objectId);
    this.dispatchEvent(
      new CustomEvent<PeerHighlightChangeEventDetail>("change", {
        detail: {
          peerId,
          role,
          objectId,
          previousObjectId
        }
      })
    );
  }

  removePeer(
    peerId: string
  ): void {
    this.mark("selection", peerId, null);
    this.mark("hover", peerId, null);
    this.#colorAllocator.release(peerId);
  }

  selectedObject(
    peerId: string
  ): string | null {
    return this.#marks.selection.markedObject(peerId);
  }

  hoveredObject(
    peerId: string
  ): string | null {
    return this.#marks.hover.markedObject(peerId);
  }

  selectors(
    objectId: string
  ): readonly string[] {
    return this.#marks.selection.peers(objectId);
  }

  hoverers(
    objectId: string
  ): readonly string[] {
    return this.#marks.hover.peers(objectId);
  }

  selectedObjectIds(): readonly string[] {
    return [...this.#marks.selection.objectIds()];
  }

  hoveredObjectIds(): readonly string[] {
    return [...this.#marks.hover.objectIds()];
  }

  peerColor(
    peerId: string
  ): string {
    return this.#colorAllocator.peerColor(peerId);
  }

  dispose(): void {
    this.#marks.selection.clear();
    this.#marks.hover.clear();
  }
}
