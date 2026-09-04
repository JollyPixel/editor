// Import Internal Dependencies
import { createSelectionOverlay, type SelectionOverlay } from "../overlays/createSelectionOverlay.ts";
import type { PeerSelectionRegistry, PeerSelectionChangeEventDetail } from "./PeerSelectionRegistry.ts";
import type { PeerHoverRegistry, PeerHoverChangeEventDetail } from "./PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import { isScenePipelineTechnique, type SelectionManager } from "../SelectionManager.ts";

// CONSTANTS
// Dimmer than `PeerSelectionOverlays`'s own default (`1`) - same role as
// `SelectionManager`'s own `hoverOpacity` default, reused here so a peer's
// hover reads with the same "faded" visual language.
const kDefaultOpacity = 0.35;

export interface PeerHoverOverlaysOptions {
  /**
   * Consulted only to check whether an object has any selector at all
   * (local or peer) - a selection always wins over a hover indicator.
   */
  selectionRegistry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry;
  selection: SelectionManager;
  /**
   * @default 0.35
   */
  opacity?: number;
  /**
   * Suppresses a peer hover overlay (same as no hoverer at all) for any
   * object `visibility.isVisible` reports `false` for - same semantics as
   * `PeerSelectionOverlays`/`PeerHighlightPass`'s own `visibility`.
   */
  visibility?: PeerSelectionVisibility;
}

/**
 * Renders exactly one dashed, faded overlay per object that a remote peer
 * is hovering - the hover counterpart to `PeerSelectionOverlays`, for the
 * `"outline"` technique. Same per-object overlay structure and oldest-wins
 * tie-break (`hoverRegistry.primaryHovererOf`), colored by
 * `hoverRegistry.colorOf`.
 *
 * Three priority rules, resolved fresh on every `#refresh(objectId)` call:
 * 1. Any current selector - local or peer - suppresses every hover
 *    indicator for the object; a full-strength selection makes a fainter
 *    hover ring underneath it redundant.
 * 2. Failing that, the local user's own hover always wins over a peer's -
 *    it already renders through `SelectionManager` itself.
 * 3. Failing both, the oldest peer currently hovering the object wins.
 *
 * `visibility` only ever gates the peer-hover branch, never the local
 * selection/hover checks above.
 */
export class PeerHoverOverlays {
  #selectionRegistry: PeerSelectionRegistry;
  #hoverRegistry: PeerHoverRegistry;
  #selection: SelectionManager;
  #opacity: number;
  #visibility: PeerSelectionVisibility | null;
  #overlays = new Map<string, SelectionOverlay>();
  #lastLocalSelected: string | null;
  #lastLocalHovered: string | null;

  #onPeerSelectionChange: (event: Event) => void;
  #onPeerHoverChange: (event: Event) => void;
  #onLocalSelectionChange: () => void;
  #onLocalHoverChange: () => void;
  #onVisibilityChange: () => void;

  constructor(
    options: PeerHoverOverlaysOptions
  ) {
    this.#selectionRegistry = options.selectionRegistry;
    this.#hoverRegistry = options.hoverRegistry;
    this.#selection = options.selection;
    this.#opacity = options.opacity ?? kDefaultOpacity;
    this.#visibility = options.visibility ?? null;
    this.#lastLocalSelected = options.selection.selected;
    this.#lastLocalHovered = options.selection.hovered;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    this.#onPeerHoverChange = (event) => {
      const { objectId, previousObjectId } = (event as CustomEvent<PeerHoverChangeEventDetail>).detail;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    this.#onLocalSelectionChange = () => {
      const previousObjectId = this.#lastLocalSelected;
      const objectId = this.#selection.selected;
      this.#lastLocalSelected = objectId;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    this.#onLocalHoverChange = () => {
      const previousObjectId = this.#lastLocalHovered;
      const objectId = this.#selection.hovered;
      this.#lastLocalHovered = objectId;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    // Re-checks every currently peer-hovered id, not just
    // `this.#overlays.keys()` - a newly *visible* id has no overlay yet to
    // iterate over.
    this.#onVisibilityChange = () => {
      for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
        this.#refresh(objectId);
      }
    };

    this.#selectionRegistry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#hoverRegistry.addEventListener("peerHoverChange", this.#onPeerHoverChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.addEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);

    // Same reasoning as `PeerSelectionOverlays`'s own constructor-time
    // sync - picks up peers already hovering before this instance existed.
    for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
      this.#refresh(objectId);
    }
  }

  /**
   * Re-applies color and x-ray to every active peer hover overlay - same
   * rationale as `PeerSelectionOverlays.refreshAll`.
   */
  refreshAll(): void {
    for (const objectId of [...this.#overlays.keys()]) {
      this.#refresh(objectId);
    }
  }

  /**
   * Detaches its listeners and disposes every active peer hover overlay.
   * Does not touch `selectionRegistry`/`hoverRegistry`/`selection`/
   * `visibility` state - only this class's own render output.
   */
  dispose(): void {
    this.#selectionRegistry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#hoverRegistry.removeEventListener("peerHoverChange", this.#onPeerHoverChange);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.removeEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.removeEventListener("visibilityChange", this.#onVisibilityChange);

    for (const overlay of this.#overlays.values()) {
      overlay.dispose();
    }
    this.#overlays.clear();
  }

  #refresh(
    objectId: string
  ): void {
    const existing = this.#overlays.get(objectId);
    const hasSelector = objectId === this.#selection.selected ||
      this.#selectionRegistry.selectorsOf(objectId).length > 0;
    const isLocalHovered = objectId === this.#selection.hovered;
    const suppressed = hasSelector || isLocalHovered;
    // `visibility` is never consulted for a suppressed id - only for an
    // otherwise-eligible peer hover.
    const culled = !suppressed && this.#visibility !== null && !this.#visibility.isVisible(objectId);
    const primaryPeerId = (suppressed || culled) ? null : this.#hoverRegistry.primaryHovererOf(objectId);

    if (primaryPeerId === null) {
      if (existing) {
        existing.dispose();
        this.#overlays.delete(objectId);
      }

      return;
    }

    const color = this.#hoverRegistry.colorOf(primaryPeerId);
    if (existing) {
      existing.setColor(color);
      existing.setXray(this.#selection.xray);

      return;
    }

    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return;
    }

    const { linewidth } = this.#selection.outlineOptions;

    // Same scene-level-pipeline fallback as `PeerSelectionOverlays` -
    // `PeerHighlightPass` is the equivalent driver for those techniques.
    const rawTechnique = this.#selection.techniqueFor(objectId);
    const technique = isScenePipelineTechnique(rawTechnique) ? "outline" : rawTechnique;

    this.#overlays.set(objectId, createSelectionOverlay(target, {
      technique,
      color,
      opacity: this.#opacity,
      linewidth,
      dashed: true,
      xray: this.#selection.xray
    }));
  }
}
