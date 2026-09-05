// Import Internal Dependencies
import type { SelectionOverlay } from "../overlays/SelectionOverlay.ts";
import type { SelectionOverlayRegistry } from "../overlays/SelectionOverlayRegistry.ts";
import type { SelectionAppearance } from "../SelectionAppearance.ts";
import type { ResolvedSelectionIndicator } from "../SelectionResolver.ts";
import type { SelectionRenderer } from "./SelectionRenderer.ts";
import { isScenePipelineTechnique } from "../SelectionManager.ts";

export interface ObjectOverlaySelectionRendererOptions {
  registry: SelectionOverlayRegistry;
  renderScene: () => void;
  boundsOnly?: boolean;
}

interface ActiveSelectionOverlay {
  overlay: SelectionOverlay;
  target: ResolvedSelectionIndicator["target"];
  technique: string;
  dashed: boolean;
}

export class ObjectOverlaySelectionRenderer implements SelectionRenderer {
  #registry: SelectionOverlayRegistry;
  #renderScene: () => void;
  #boundsOnly: boolean;
  #overlays = new Map<string, ActiveSelectionOverlay>();

  constructor(
    options: ObjectOverlaySelectionRendererOptions
  ) {
    this.#registry = options.registry;
    this.#renderScene = options.renderScene;
    this.#boundsOnly = options.boundsOnly ?? false;
  }

  sync(
    indicators: readonly ResolvedSelectionIndicator[],
    appearance: SelectionAppearance
  ): void {
    const next = new Map<string, ActiveSelectionOverlay>();
    const created: SelectionOverlay[] = [];

    try {
      for (const indicator of indicators) {
        const technique = this.#techniqueFor(indicator);
        const dashed = indicator.role === "hover" &&
          indicator.source === "peer";
        const current = this.#overlays.get(indicator.objectId);
        if (
          current &&
          current.target === indicator.target &&
          current.technique === technique &&
          current.dashed === dashed
        ) {
          next.set(indicator.objectId, current);
          continue;
        }

        const overlay = this.#registry.create(indicator.target, {
          technique,
          color: indicator.color,
          opacity: indicator.opacity,
          linewidth: appearance.outline.linewidth,
          fillOpacity: appearance.bounds.fillOpacity,
          xray: appearance.xray,
          dashed
        });
        created.push(overlay);
        next.set(indicator.objectId, {
          overlay,
          target: indicator.target,
          technique,
          dashed
        });
      }
    }
    catch (error) {
      for (const overlay of created) {
        overlay.dispose();
      }
      throw error;
    }

    for (const [objectId, current] of this.#overlays) {
      if (next.get(objectId) !== current) {
        current.overlay.dispose();
      }
    }
    for (const indicator of indicators) {
      const overlay = next.get(indicator.objectId)!.overlay;
      overlay.color = indicator.color;
      overlay.opacity = indicator.opacity;
      overlay.xray = appearance.xray;
      if (overlay.fillOpacity !== undefined) {
        overlay.fillOpacity = appearance.bounds.fillOpacity;
      }
      if (overlay.linewidth !== undefined) {
        overlay.linewidth = appearance.outline.linewidth;
      }
    }
    this.#overlays = next;
  }

  render(): void {
    for (const { overlay } of this.#overlays.values()) {
      overlay.update?.();
    }
    this.#renderScene();
  }

  dispose(): void {
    for (const { overlay } of this.#overlays.values()) {
      overlay.dispose();
    }
    this.#overlays.clear();
  }

  #techniqueFor(
    indicator: ResolvedSelectionIndicator
  ): string {
    if (this.#boundsOnly) {
      return "boundingBox";
    }
    if (isScenePipelineTechnique(indicator.technique)) {
      return "outline";
    }

    return indicator.technique;
  }
}
