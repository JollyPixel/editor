// Import Internal Dependencies
import { createSelectionOverlay, type SelectionOverlay } from "../overlays/createSelectionOverlay.ts";
import type { PeerSelectionRegistry, PeerSelectionChangeEventDetail } from "./PeerSelectionRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import type { SelectionManager } from "../SelectionManager.ts";

export interface PeerSelectionOverlaysOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * @default 1
   */
  opacity?: number;
  /**
   * Suppresses a peer overlay (same as no selector at all) for any object
   * `visibility.isVisible` reports `false` for - e.g. outside the camera
   * frustum or beyond a configured max distance. Never consulted for the
   * local user's own selection. Omitting this preserves today's
   * always-visible behavior.
   */
  visibility?: PeerSelectionVisibility;
}

/**
 * Renders exactly one overlay per object that a remote peer has selected,
 * colored by `registry.primarySelectorOf` (the peer that selected it
 * first) - never one overlay per peer, regardless of how many peers are
 * selecting the same object at once. This is the render-side half of the
 * "single 3D overlay, full detail in the outliner" split: the full list of
 * selectors per object still lives in `registry.selectorsOf`, for a caller
 * to render as avatar chips elsewhere.
 *
 * Whenever the local `SelectionManager` also has an object selected, its
 * own overlay wins visually - the peer overlay for that object is
 * suppressed (not removed from the registry, just hidden) and reappears
 * the instant the local selection moves away.
 */
export class PeerSelectionOverlays {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #opacity: number;
  #visibility: PeerSelectionVisibility | null;
  #overlays = new Map<string, SelectionOverlay>();
  #lastLocalSelected: string | null;

  #onPeerSelectionChange: (event: Event) => void;
  #onLocalSelectionChange: () => void;
  #onVisibilityChange: () => void;

  constructor(
    options: PeerSelectionOverlaysOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#opacity = options.opacity ?? 1;
    this.#visibility = options.visibility ?? null;
    this.#lastLocalSelected = options.selection.selected;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

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

    // Re-checks every currently peer-selected id, not just `this.#overlays.keys()`
    // - a newly *visible* id has no overlay yet to iterate over.
    this.#onVisibilityChange = () => {
      for (const objectId of this.#registry.selectedObjectIds()) {
        this.#refresh(objectId);
      }
    };

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);
  }

  /**
   * Detaches its listeners and disposes every active peer overlay. Does not
   * touch `registry`/`selection`/`visibility` state - only this class's own
   * render output.
   */
  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
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
    const isLocalSelected = objectId === this.#selection.selected;
    // `visibility` is never consulted for the local selection above - only
    // for a peer's - see `PeerSelectionOverlaysOptions.visibility`'s own doc
    // comment.
    const culled = !isLocalSelected && this.#visibility !== null && !this.#visibility.isVisible(objectId);
    const primaryPeerId = (isLocalSelected || culled) ? null : this.#registry.primarySelectorOf(objectId);

    if (primaryPeerId === null) {
      if (existing) {
        existing.dispose();
        this.#overlays.delete(objectId);
      }

      return;
    }

    const color = this.#registry.colorOf(primaryPeerId);
    if (existing) {
      existing.setColor(color);

      return;
    }

    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return;
    }

    const { linewidth } = this.#selection.outlineOptions;
    const { fillOpacity } = this.#selection.boundingBoxOptions;

    // A peer overlay always builds a disposable per-object overlay, one per
    // selecting peer's color - `"coloredOutline"` has no such thing (a
    // single shared pipeline, not a per-id instance, see
    // `ColoredOutlinePass`'s own doc comment), so it can't represent more
    // than one simultaneously colored peer selection. Falls back to
    // `"outline"` in that case rather than mishandling the technique.
    const rawTechnique = this.#selection.techniqueFor(objectId);
    const technique = rawTechnique === "coloredOutline" ? "outline" : rawTechnique;

    this.#overlays.set(objectId, createSelectionOverlay(target, {
      technique,
      color,
      opacity: this.#opacity,
      linewidth,
      fillOpacity,
      xray: this.#selection.xray
    }));
  }
}
