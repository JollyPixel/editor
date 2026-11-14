// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightSilhouette,
  type SilhouetteAnchorOptions,
  type SilhouetteShape,
  type SilhouetteView
} from "./HighlightSilhouette.ts";
import type { MeshContour } from "./meshContour.ts";

class HullSilhouetteShape implements SilhouetteShape {
  #contour: MeshContour;

  constructor(
    contour: MeshContour
  ) {
    this.#contour = contour;
  }

  reshape(
    contour: MeshContour
  ): void {
    this.#contour = contour;
  }

  viewFrom(
    localCameraPosition: THREE.Vector3
  ): SilhouetteView {
    return this.#contour.viewFrom(localCameraPosition);
  }
}

export interface HighlightHullSilhouetteOptions extends SilhouetteAnchorOptions {
  contour: MeshContour;
}

export class HighlightHullSilhouette extends HighlightSilhouette {
  #shape: HullSilhouetteShape;

  constructor(
    options: HighlightHullSilhouetteOptions
  ) {
    const shape = new HullSilhouetteShape(options.contour);
    super(shape, options);
    this.#shape = shape;
  }

  reshape(
    contour: MeshContour
  ): void {
    this.#shape.reshape(contour);
  }
}
