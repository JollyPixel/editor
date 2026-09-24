// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightOverlay } from "../overlays/HighlightOverlay.ts";
import type { HighlightOverlayRegistry } from "../overlays/HighlightOverlayRegistry.ts";
import type { MeshHighlightAppearance } from "../MeshHighlightAppearance.ts";
import type { ResolvedHighlightIndicator } from "../HighlightResolver.ts";
import type { MeshHighlightRenderer } from "./MeshHighlightRenderer.ts";
import { isScenePipelineTechnique } from "../MeshHighlightState.ts";

export interface ObjectOverlayRendererOptions {
  registry: HighlightOverlayRegistry;
  renderScene: () => void;
  camera: THREE.Camera;
  boundsOnly?: boolean;
}

interface ActiveHighlightOverlay {
  overlay: HighlightOverlay;
  target: ResolvedHighlightIndicator["target"];
  technique: string;
  dashed: boolean;
  source: ResolvedHighlightIndicator["source"];
}

export class ObjectOverlayRenderer implements MeshHighlightRenderer {
  #registry: HighlightOverlayRegistry;
  #renderScene: () => void;
  #camera: THREE.Camera;
  #boundsOnly: boolean;
  #overlays = new Map<string, ActiveHighlightOverlay>();
  #cameraWorldPosition = new THREE.Vector3();

  constructor(
    options: ObjectOverlayRendererOptions
  ) {
    this.#registry = options.registry;
    this.#renderScene = options.renderScene;
    this.#camera = options.camera;
    this.#boundsOnly = options.boundsOnly ?? false;
  }

  sync(
    indicators: readonly ResolvedHighlightIndicator[],
    appearance: MeshHighlightAppearance
  ): void {
    const next = new Map<string, ActiveHighlightOverlay>();
    const created: HighlightOverlay[] = [];

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
          current.dashed === dashed &&
          current.source === indicator.source
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
          dashed,
          occludedOpacity: occludedOpacityFor(indicator, appearance),
          peer: indicator.source === "peer",
          renderOrder: appearance.renderOrder ?? undefined,
          xrayDepthWrite: appearance.xrayDepthWrite
        });
        created.push(overlay);
        next.set(indicator.objectId, {
          overlay,
          target: indicator.target,
          technique,
          dashed,
          source: indicator.source
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
      if (overlay.occludedOpacity !== undefined) {
        overlay.occludedOpacity = occludedOpacityFor(indicator, appearance);
      }
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
    this.#camera.getWorldPosition(this.#cameraWorldPosition);
    for (const { overlay } of this.#overlays.values()) {
      overlay.update?.(this.#cameraWorldPosition);
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
    indicator: ResolvedHighlightIndicator
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

function occludedOpacityFor(
  indicator: ResolvedHighlightIndicator,
  appearance: MeshHighlightAppearance
): number {
  return appearance.occludedOpacityScale === null ?
    indicator.opacity :
    indicator.opacity * appearance.occludedOpacityScale;
}
