// Import Internal Dependencies
import type { SelectionOverlay } from "../overlays/SelectionOverlay.ts";
import type {
  PeerSelectionRegistry,
  PeerSelectionChangeEventDetail
} from "./PeerSelectionRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import {
  isScenePipelineTechnique,
  type SelectionManager
} from "../SelectionManager.ts";

export interface PeerSelectionOverlaysOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * @default 1
   */
  opacity?: number;
  /**
   * Suppresses peer overlays for objects reported as invisible.
   */
  visibility?: PeerSelectionVisibility;
}

export class PeerSelectionOverlays {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #opacity: number | null;
  #visibility: PeerSelectionVisibility | null;
  #overlays = new Map<string, SelectionOverlay>();
  #lastLocalSelected: string | null;

  #onPeerSelectionChange: (event: CustomEvent<PeerSelectionChangeEventDetail>) => void;
  #onLocalSelectionChange: () => void;
  #onVisibilityChange: () => void;
  #onPresentationChange: () => void;
  #onSelectionDispose: () => void;

  constructor(
    options: PeerSelectionOverlaysOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#opacity = options.opacity ?? null;
    this.#visibility = options.visibility ?? null;
    this.#lastLocalSelected = options.selection.selected;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = event.detail;

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

    this.#onVisibilityChange = () => {
      for (const objectId of this.#registry.selectedObjectIds()) {
        this.#refresh(objectId);
      }
    };
    this.#onPresentationChange = () => this.#rebuildAll();
    this.#onSelectionDispose = () => this.dispose();

    this.#registry.addEventListener(
      "peerSelectionChange",
      this.#onPeerSelectionChange
    );
    this.#selection.addEventListener(
      "selectionChange",
      this.#onLocalSelectionChange
    );
    this.#selection.addEventListener(
      "appearanceChange",
      this.#onPresentationChange
    );
    this.#selection.addEventListener(
      "techniqueChange",
      this.#onPresentationChange
    );
    this.#selection.addEventListener(
      "targetsChange",
      this.#onPresentationChange
    );
    this.#selection.addEventListener("dispose", this.#onSelectionDispose);
    this.#visibility?.addEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );

    for (const objectId of this.#registry.selectedObjectIds()) {
      this.#refresh(objectId);
    }
  }

  refreshAll(): void {
    for (const objectId of [...this.#overlays.keys()]) {
      this.#refresh(objectId);
    }
  }

  dispose(): void {
    this.#registry.removeEventListener(
      "peerSelectionChange",
      this.#onPeerSelectionChange
    );
    this.#selection.removeEventListener(
      "selectionChange",
      this.#onLocalSelectionChange
    );
    this.#selection.removeEventListener(
      "appearanceChange",
      this.#onPresentationChange
    );
    this.#selection.removeEventListener(
      "techniqueChange",
      this.#onPresentationChange
    );
    this.#selection.removeEventListener(
      "targetsChange",
      this.#onPresentationChange
    );
    this.#selection.removeEventListener("dispose", this.#onSelectionDispose);
    this.#visibility?.removeEventListener(
      "visibilityChange",
      this.#onVisibilityChange
    );

    for (const overlay of this.#overlays.values()) {
      overlay.dispose();
    }
    this.#overlays.clear();
  }

  #rebuildAll(): void {
    for (const overlay of this.#overlays.values()) {
      overlay.dispose();
    }
    this.#overlays.clear();

    for (const objectId of this.#registry.selectedObjectIds()) {
      this.#refresh(objectId);
    }
  }

  #refresh(
    objectId: string
  ): void {
    const existing = this.#overlays.get(objectId);
    const isLocalSelected = objectId === this.#selection.selected;
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
      existing.color = color;
      existing.xray = this.#selection.appearance.xray;
      if ("fillOpacity" in existing) {
        existing.fillOpacity =
          this.#selection.appearance.bounds.fillOpacity;
      }

      return;
    }

    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return;
    }

    const { linewidth } = this.#selection.appearance.outline;
    const { fillOpacity } = this.#selection.appearance.bounds;

    const rawTechnique = this.#selection.techniqueFor(objectId);
    const technique = isScenePipelineTechnique(rawTechnique) ? "outline" : rawTechnique;

    const overlay = this.#selection.overlayRegistry.create(target, {
      technique,
      color,
      opacity: this.#opacity ??
        this.#selection.appearance.selected.opacity,
      linewidth,
      fillOpacity,
      xray: this.#selection.appearance.xray
    });
    this.#overlays.set(objectId, overlay);
  }
}
