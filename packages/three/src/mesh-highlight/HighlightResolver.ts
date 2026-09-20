// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  MeshHighlightState,
  HighlightTechnique
} from "./MeshHighlightState.ts";
import type { PeerSelectionRegistry } from "./peer/PeerSelectionRegistry.ts";
import type { PeerHoverRegistry } from "./peer/PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "./peer/PeerSelectionVisibility.ts";

export type HighlightIndicatorRole = "selection" | "hover";
export type HighlightIndicatorSource = "local" | "peer";

export interface ResolvedHighlightIndicator {
  objectId: string;
  target: THREE.Object3D;
  role: HighlightIndicatorRole;
  source: HighlightIndicatorSource;
  peerId?: string;
  color: THREE.ColorRepresentation;
  opacity: number;
  technique: HighlightTechnique;
}

export interface HighlightResolverOptions {
  state: MeshHighlightState;
  peerSelections?: PeerSelectionRegistry;
  peerHovers?: PeerHoverRegistry;
  visibility?: PeerSelectionVisibility;
}

/**
 * Resolves local and peer intent into one visible indicator per object.
 */
export class HighlightResolver {
  #state: MeshHighlightState;
  #peerSelections: PeerSelectionRegistry | null;
  #peerHovers: PeerHoverRegistry | null;
  #visibility: PeerSelectionVisibility | null;

  constructor(
    options: HighlightResolverOptions
  ) {
    this.#state = options.state;
    this.#peerSelections = options.peerSelections ?? null;
    this.#peerHovers = options.peerHovers ?? null;
    this.#visibility = options.visibility ?? null;
  }

  resolve(): readonly ResolvedHighlightIndicator[] {
    const objectIds = new Set<string>();
    if (this.#state.selected !== null) {
      objectIds.add(this.#state.selected);
    }
    if (this.#state.hovered !== null) {
      objectIds.add(this.#state.hovered);
    }
    for (const id of this.#peerSelections?.selectedObjectIds() ?? []) {
      objectIds.add(id);
    }
    for (const id of this.#peerHovers?.hoveredObjectIds() ?? []) {
      objectIds.add(id);
    }

    const indicators: ResolvedHighlightIndicator[] = [];
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
  ): ResolvedHighlightIndicator | null {
    const target = this.#state.targetFor(objectId);
    if (!target) {
      return null;
    }

    const technique = this.#state.techniqueFor(objectId);
    if (objectId === this.#state.selected) {
      return {
        objectId,
        target,
        role: "selection",
        source: "local",
        color: this.#state.appearance.selected.color,
        opacity: this.#state.appearance.selected.opacity,
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
        opacity: this.#state.appearance.selected.opacity,
        technique
      };
    }

    if (objectId === this.#state.hovered) {
      return {
        objectId,
        target,
        role: "hover",
        source: "local",
        color: this.#state.appearance.hovered.color,
        opacity: this.#state.appearance.hovered.opacity,
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
      opacity: this.#state.appearance.hovered.opacity,
      technique
    };
  }
}
