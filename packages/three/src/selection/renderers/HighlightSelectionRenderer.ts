// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightEntry } from "../postprocess/HighlightPass.ts";
import type { SelectionOverlayRegistry } from "../overlays/SelectionOverlayRegistry.ts";
import type { SelectionAppearance } from "../SelectionAppearance.ts";
import type { ResolvedSelectionIndicator } from "../SelectionResolver.ts";
import type { SelectionRenderer } from "./SelectionRenderer.ts";
import { isScenePipelineTechnique } from "../SelectionManager.ts";
import { ObjectOverlaySelectionRenderer } from "./ObjectOverlaySelectionRenderer.ts";

// CONSTANTS
const kPeerHoverDarkenFactor = 0.35;

export interface SelectionHighlightTarget {
  entries: HighlightEntry[];
  render(): void;
  dispose(): void;
}

export interface HighlightSelectionRendererOptions {
  highlight: SelectionHighlightTarget;
  overlayRegistry: SelectionOverlayRegistry;
}

export class HighlightSelectionRenderer implements SelectionRenderer {
  #highlight: SelectionHighlightTarget;
  #overlays: ObjectOverlaySelectionRenderer;

  constructor(
    options: HighlightSelectionRendererOptions
  ) {
    this.#highlight = options.highlight;
    this.#overlays = new ObjectOverlaySelectionRenderer({
      registry: options.overlayRegistry,
      renderScene: () => void 0
    });
  }

  sync(
    indicators: readonly ResolvedSelectionIndicator[],
    appearance: SelectionAppearance
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
  indicator: ResolvedSelectionIndicator
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
