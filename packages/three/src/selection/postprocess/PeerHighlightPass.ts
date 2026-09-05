// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightPass, HighlightEntry } from "./HighlightPass.ts";
import type { PeerSelectionRegistry } from "../peer/PeerSelectionRegistry.ts";
import type { PeerHoverRegistry } from "../peer/PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "../peer/PeerSelectionVisibility.ts";
import type { SelectionManager } from "../SelectionManager.ts";

// CONSTANTS
const kHoverDarkenFactor = 0.35;

/**
 * Minimum highlight target used by this adapter.
 */
export type HighlightTarget = Pick<HighlightPass, "entries">;

export interface PeerHighlightPassOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  highlight: HighlightTarget;
  /**
   * Suppresses invisible peer entries.
   */
  visibility?: PeerSelectionVisibility;
  /**
   * Includes peer hover entries when provided.
   */
  hoverRegistry?: PeerHoverRegistry;
}

/**
 * Converts local and peer selection state into highlight entries.
 * Local selections take priority; hover entries are isolated.
 */
export class PeerHighlightPass {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #highlight: HighlightTarget;
  #visibility: PeerSelectionVisibility | null;
  #hoverRegistry: PeerHoverRegistry | null;

  #onPeerSelectionChange = (): void => this.refresh();
  #onLocalSelectionChange = (): void => this.refresh();
  #onLocalHoverChange = (): void => this.refresh();
  #onVisibilityChange = (): void => this.refresh();
  #onPeerHoverChange = (): void => this.refresh();
  #onPresentationChange = (): void => this.refresh();
  #onSelectionDispose = (): void => this.dispose();

  constructor(
    options: PeerHighlightPassOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#highlight = options.highlight;
    this.#visibility = options.visibility ?? null;
    this.#hoverRegistry = options.hoverRegistry ?? null;

    this.#registry.addEventListener(
      "peerSelectionChange",
      this.#onPeerSelectionChange
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
    this.#hoverRegistry?.addEventListener(
      "peerHoverChange",
      this.#onPeerHoverChange
    );

    this.refresh();
  }

  /**
   * Detaches subscriptions without disposing dependencies.
   */
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
    this.#hoverRegistry?.removeEventListener(
      "peerHoverChange",
      this.#onPeerHoverChange
    );
    this.#highlight.entries = [];
  }

  /**
   * Rebuilds and publishes the complete entry list.
   */
  refresh(): void {
    const localSelected = this.#selection.selected;
    const localHovered = this.#selection.hovered === localSelected ? null : this.#selection.hovered;

    const objectIds = new Set(
      this.#registry.selectedObjectIds()
    );
    if (this.#hoverRegistry) {
      for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
        objectIds.add(objectId);
      }
    }
    if (localSelected !== null) {
      objectIds.add(localSelected);
    }
    if (localHovered !== null) {
      objectIds.add(localHovered);
    }

    const entries: HighlightEntry[] = [];

    for (const objectId of objectIds) {
      const target = this.#selection.targetFor(objectId);
      if (target === undefined) {
        continue;
      }

      if (objectId === localSelected) {
        entries.push({
          target,
          color: this.#selection.appearance.selected.color,
          priority: true
        });
        continue;
      }

      if (objectId === localHovered) {
        entries.push({
          target,
          color: this.#selection.appearance.hovered.color,
          isolated: true
        });
        continue;
      }

      const visible = this.#visibility === null || this.#visibility.isVisible(objectId);

      const peerId = visible ? this.#registry.primarySelectorOf(objectId) : null;
      if (peerId !== null) {
        entries.push({
          target,
          color: this.#registry.colorOf(peerId)
        });
        continue;
      }

      if (
        this.#registry.selectorsOf(objectId).length > 0 ||
        !visible ||
        this.#hoverRegistry === null
      ) {
        continue;
      }

      const hovererId = this.#hoverRegistry.primaryHovererOf(objectId);
      if (hovererId === null) {
        continue;
      }

      entries.push({
        target,
        color: this.#darken(this.#hoverRegistry.colorOf(hovererId)),
        isolated: true
      });
    }

    this.#highlight.entries = entries;
  }

  #darken(
    color: THREE.ColorRepresentation
  ): THREE.Color {
    return new THREE.Color(color).lerp(
      new THREE.Color(0x000000),
      kHoverDarkenFactor
    );
  }
}
