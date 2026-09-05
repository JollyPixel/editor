// Import Internal Dependencies
import type { SelectionOverlay } from "../overlays/SelectionOverlay.ts";
import type {
  PeerSelectionRegistry,
  PeerSelectionChangeEventDetail
} from "./PeerSelectionRegistry.ts";
import type {
  PeerHoverRegistry,
  PeerHoverChangeEventDetail
} from "./PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import {
  isScenePipelineTechnique,
  type SelectionManager
} from "../SelectionManager.ts";

export interface PeerHoverOverlaysOptions {
  /**
   * Used to suppress hover overlays for selected objects.
   */
  selectionRegistry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry;
  selection: SelectionManager;
  /**
   * @default 0.35
   */
  opacity?: number;
  /**
   * Suppresses overlays for objects reported as invisible.
   */
  visibility?: PeerSelectionVisibility;
}

export class PeerHoverOverlays {
  #selectionRegistry: PeerSelectionRegistry;
  #hoverRegistry: PeerHoverRegistry;
  #selection: SelectionManager;
  #opacity: number | null;
  #visibility: PeerSelectionVisibility | null;
  #overlays = new Map<string, SelectionOverlay>();
  #lastLocalSelected: string | null;
  #lastLocalHovered: string | null;

  #onPeerSelectionChange: (event: CustomEvent<PeerSelectionChangeEventDetail>) => void;
  #onPeerHoverChange: (event: CustomEvent<PeerHoverChangeEventDetail>) => void;
  #onLocalSelectionChange: () => void;
  #onLocalHoverChange: () => void;
  #onVisibilityChange: () => void;
  #onPresentationChange: () => void;
  #onSelectionDispose: () => void;

  constructor(
    options: PeerHoverOverlaysOptions
  ) {
    this.#selectionRegistry = options.selectionRegistry;
    this.#hoverRegistry = options.hoverRegistry;
    this.#selection = options.selection;
    this.#opacity = options.opacity ?? null;
    this.#visibility = options.visibility ?? null;
    this.#lastLocalSelected = options.selection.selected;
    this.#lastLocalHovered = options.selection.hovered;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = event.detail;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    this.#onPeerHoverChange = (event) => {
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

    this.#onVisibilityChange = () => {
      for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
        this.#refresh(objectId);
      }
    };
    this.#onPresentationChange = () => this.#rebuildAll();
    this.#onSelectionDispose = () => this.dispose();

    this.#selectionRegistry.addEventListener(
      "peerSelectionChange",
      this.#onPeerSelectionChange
    );
    this.#hoverRegistry.addEventListener(
      "peerHoverChange",
      this.#onPeerHoverChange
    );
    this.#selection.addEventListener(
      "selectionChange",
      this.#onLocalSelectionChange
    );
    this.#selection.addEventListener(
      "hoverChange",
      this.#onLocalHoverChange
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

    for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
      this.#refresh(objectId);
    }
  }

  refreshAll(): void {
    for (const objectId of [...this.#overlays.keys()]) {
      this.#refresh(objectId);
    }
  }

  dispose(): void {
    this.#selectionRegistry.removeEventListener(
      "peerSelectionChange",
      this.#onPeerSelectionChange
    );
    this.#hoverRegistry.removeEventListener(
      "peerHoverChange",
      this.#onPeerHoverChange
    );
    this.#selection.removeEventListener(
      "selectionChange",
      this.#onLocalSelectionChange
    );
    this.#selection.removeEventListener(
      "hoverChange",
      this.#onLocalHoverChange
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

    for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
      this.#refresh(objectId);
    }
  }

  #refresh(
    objectId: string
  ): void {
    const existing = this.#overlays.get(objectId);
    const hasSelector = objectId === this.#selection.selected ||
      this.#selectionRegistry.selectorsOf(objectId).length > 0;
    const isLocalHovered = objectId === this.#selection.hovered;
    const suppressed = hasSelector || isLocalHovered;
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
      existing.color = color;
      existing.xray = this.#selection.appearance.xray;

      return;
    }

    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return;
    }

    const { linewidth } = this.#selection.appearance.outline;

    const rawTechnique = this.#selection.techniqueFor(objectId);
    const technique = isScenePipelineTechnique(rawTechnique) ? "outline" : rawTechnique;

    this.#overlays.set(objectId, this.#selection.overlayRegistry.create(target, {
      technique,
      color,
      opacity: this.#opacity ??
        this.#selection.appearance.hovered.opacity,
      linewidth,
      dashed: true,
      xray: this.#selection.appearance.xray
    }));
  }
}
