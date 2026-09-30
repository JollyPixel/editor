// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ObjectOverlayRenderer,
  HighlightOverlayRegistry,
  type ResolvedHighlightIndicator,
  type HighlightOverlay,
  type HighlightOverlayCreateOptions
} from "#src/index.ts";

// CONSTANTS
const kUnsetOpacity = -1;
export const CAMERA = new THREE.PerspectiveCamera();

export class TestOverlay implements HighlightOverlay {
  readonly createOptions: HighlightOverlayCreateOptions;
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  fillOpacity = 0;
  linewidth = 1;
  occludedOpacity: number;
  peer: boolean;
  disposeCount = 0;
  calls: string[] = [];

  constructor(
    options: HighlightOverlayCreateOptions
  ) {
    this.createOptions = options;
    this.color = options.color;
    this.opacity = options.opacity;
    this.xray = options.xray ?? false;
    this.peer = options.peer ?? false;
    this.occludedOpacity = options.occludedOpacity ?? kUnsetOpacity;
  }

  update(): void {
    this.calls.push("update");
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

export function createRegistry(
  overlays: TestOverlay[]
): HighlightOverlayRegistry {
  const registry = new HighlightOverlayRegistry({
    defaultId: "outline",
    fallbackId: "outline"
  });
  for (const id of ["outline", "custom", "boundingBox"]) {
    registry.register({
      id,
      supports: () => true,
      create: (_target, options) => {
        const overlay = new TestOverlay(options);
        overlays.push(overlay);

        return overlay;
      }
    });
  }

  return registry;
}

export function createObjectOverlayRenderer(
  overlays: TestOverlay[]
): ObjectOverlayRenderer {
  return new ObjectOverlayRenderer({
    registry: createRegistry(overlays),
    renderScene: () => void 0,
    camera: CAMERA
  });
}

export function indicator(
  target: THREE.Object3D,
  options: Partial<ResolvedHighlightIndicator> = {}
): ResolvedHighlightIndicator {
  return {
    objectId: "object",
    target,
    role: "selection",
    source: "local",
    color: "#ffffff",
    opacity: 1,
    technique: "outline",
    ...options
  };
}
