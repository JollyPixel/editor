// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  SelectionManager,
  SelectionTechnique
} from "./SelectionManager.ts";
import type { PeerSelectionRegistry } from "./peer/PeerSelectionRegistry.ts";
import type { PeerHoverRegistry } from "./peer/PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "./peer/PeerSelectionVisibility.ts";

export type SelectionIndicatorRole = "selection" | "hover";
export type SelectionIndicatorSource = "local" | "peer";

export interface ResolvedSelectionIndicator {
  objectId: string;
  target: THREE.Object3D;
  role: SelectionIndicatorRole;
  source: SelectionIndicatorSource;
  peerId?: string;
  color: THREE.ColorRepresentation;
  opacity: number;
  technique: SelectionTechnique;
}

export interface SelectionResolverOptions {
  selection: SelectionManager;
  peerSelections?: PeerSelectionRegistry;
  peerHovers?: PeerHoverRegistry;
  visibility?: PeerSelectionVisibility;
}

/**
 * Resolves local and peer intent into one visible indicator per object.
 */
export class SelectionResolver {
  #selection: SelectionManager;
  #peerSelections: PeerSelectionRegistry | null;
  #peerHovers: PeerHoverRegistry | null;
  #visibility: PeerSelectionVisibility | null;

  constructor(
    options: SelectionResolverOptions
  ) {
    this.#selection = options.selection;
    this.#peerSelections = options.peerSelections ?? null;
    this.#peerHovers = options.peerHovers ?? null;
    this.#visibility = options.visibility ?? null;
  }

  resolve(): readonly ResolvedSelectionIndicator[] {
    const objectIds = new Set<string>();
    if (this.#selection.selected !== null) {
      objectIds.add(this.#selection.selected);
    }
    if (this.#selection.hovered !== null) {
      objectIds.add(this.#selection.hovered);
    }
    for (const id of this.#peerSelections?.selectedObjectIds() ?? []) {
      objectIds.add(id);
    }
    for (const id of this.#peerHovers?.hoveredObjectIds() ?? []) {
      objectIds.add(id);
    }

    const indicators: ResolvedSelectionIndicator[] = [];
    for (const objectId of objectIds) {
      const indicator = this.#resolveObject(objectId);
      if (indicator) {
        indicators.push(indicator);
      }
    }

    return indicators;
  }

  #resolveObject(
    objectId: string
  ): ResolvedSelectionIndicator | null {
    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return null;
    }

    const technique = this.#selection.techniqueFor(objectId);
    if (objectId === this.#selection.selected) {
      return {
        objectId,
        target,
        role: "selection",
        source: "local",
        color: this.#selection.appearance.selected.color,
        opacity: this.#selection.appearance.selected.opacity,
        technique
      };
    }

    const peersVisible = this.#visibility?.isVisible(objectId) ?? true;
    const selectorId = peersVisible ?
      this.#peerSelections?.primarySelectorOf(objectId) ?? null :
      null;
    if (selectorId !== null) {
      return {
        objectId,
        target,
        role: "selection",
        source: "peer",
        peerId: selectorId,
        color: this.#peerSelections!.colorOf(selectorId),
        opacity: this.#selection.appearance.selected.opacity,
        technique
      };
    }

    if (objectId === this.#selection.hovered) {
      return {
        objectId,
        target,
        role: "hover",
        source: "local",
        color: this.#selection.appearance.hovered.color,
        opacity: this.#selection.appearance.hovered.opacity,
        technique
      };
    }

    const hovererId = peersVisible ?
      this.#peerHovers?.primaryHovererOf(objectId) ?? null :
      null;
    if (hovererId === null) {
      return null;
    }

    return {
      objectId,
      target,
      role: "hover",
      source: "peer",
      peerId: hovererId,
      color: this.#peerHovers!.colorOf(hovererId),
      opacity: this.#selection.appearance.hovered.opacity,
      technique
    };
  }
}
