// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  MeshHighlightState,
  HighlightTechnique
} from "./MeshHighlightState.ts";
import type {
  HighlightIndicatorRole,
  PeerHighlights
} from "./peer/PeerHighlights.ts";
import type { PeerVisibility } from "./peer/PeerVisibility.ts";

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
  peers: PeerHighlights;
  visibility?: PeerVisibility;
}

export class HighlightResolver {
  #state: MeshHighlightState;
  #peers: PeerHighlights;
  #visibility: PeerVisibility | null;

  constructor(
    options: HighlightResolverOptions
  ) {
    this.#state = options.state;
    this.#peers = options.peers;
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
    for (const id of this.#state.emphasized) {
      objectIds.add(id);
    }
    for (const id of this.#peers.selectedObjectIds()) {
      objectIds.add(id);
    }
    for (const id of this.#peers.hoveredObjectIds()) {
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
    const target = this.#state.findTarget(objectId);
    if (!target) {
      return null;
    }

    const technique = this.#state.resolveTechnique(objectId);
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
      this.#peers.selectors(objectId)[0] ?? null :
      null;
    if (selectorId !== null) {
      return {
        objectId,
        target,
        role: "selection",
        source: "peer",
        peerId: selectorId,
        color: this.#peers.peerColor(selectorId),
        opacity: this.#state.appearance.selected.opacity,
        technique
      };
    }

    if (objectId === this.#state.hovered || this.#state.emphasized.has(objectId)) {
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
      this.#peers.hoverers(objectId)[0] ?? null :
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
      color: this.#peers.peerColor(hovererId),
      opacity: this.#state.appearance.hovered.opacity,
      technique
    };
  }
}
