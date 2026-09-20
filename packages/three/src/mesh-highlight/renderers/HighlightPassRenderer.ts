// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightEntry } from "../postprocess/HighlightPass.ts";
import type { HighlightOverlayRegistry } from "../overlays/HighlightOverlayRegistry.ts";
import type { MeshHighlightAppearance } from "../MeshHighlightAppearance.ts";
import type { ResolvedHighlightIndicator } from "../HighlightResolver.ts";
import type { MeshHighlightRenderer } from "./MeshHighlightRenderer.ts";
import { isScenePipelineTechnique } from "../MeshHighlightState.ts";
import { ObjectOverlayRenderer } from "./ObjectOverlayRenderer.ts";

// CONSTANTS
const kPeerHoverDarkenFactor = 0.35;

export interface HighlightPassTarget {
  entries: HighlightEntry[];
  render(): void;
  dispose(): void;
}

export interface HighlightPassRendererOptions {
  highlight: HighlightPassTarget;
  overlayRegistry: HighlightOverlayRegistry;
}

export class HighlightPassRenderer implements MeshHighlightRenderer {
  #highlight: HighlightPassTarget;
  #overlays: ObjectOverlayRenderer;

  constructor(
    options: HighlightPassRendererOptions
  ) {
    this.#highlight = options.highlight;
    this.#overlays = new ObjectOverlayRenderer({
      registry: options.overlayRegistry,
      renderScene: () => void 0
    });
  }

  sync(
    indicators: readonly ResolvedHighlightIndicator[],
    appearance: MeshHighlightAppearance
  ): void {
    const highlighted = indicators.filter(isHighlightIndicator);
    const entries = highlighted.map((indicator): HighlightEntry => {
      const peerHover = indicator.role === "hover" &&
        indicator.source === "peer";

      return {
        target: indicator.target,
        color: peerHover ? darken(indicator.color) : indicator.color,
        priority: indicator.role === "selection" &&
          indicator.source === "local",
        isolated: indicator.role === "hover"
      };
    });
    this.#highlight.entries = entries;
    const highlightedIds = new Set(
      highlighted.map(({ objectId }) => objectId)
    );
    this.#overlays.sync(
      indicators.filter(({ objectId }) => !highlightedIds.has(objectId)),
      appearance
    );
  }

  render(): void {
    this.#overlays.render();
    this.#highlight.render();
  }

  dispose(): void {
    this.#overlays.dispose();
    this.#highlight.entries = [];
    this.#highlight.dispose();
  }
}

function isHighlightIndicator(
  indicator: ResolvedHighlightIndicator
): boolean {
  return indicator.target instanceof THREE.Mesh &&
    isScenePipelineTechnique(indicator.technique);
}

function darken(
  color: THREE.ColorRepresentation
): THREE.Color {
  return new THREE.Color(color).lerp(
    new THREE.Color(0x000000),
    kPeerHoverDarkenFactor
  );
}
