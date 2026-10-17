// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightSilhouette,
  type HighlightSilhouetteOptions,
  type SilhouetteShape,
  type SilhouetteView
} from "./HighlightSilhouette.ts";
import {
  buildSilhouetteGeometry,
  computeVisibleFaces,
  measureHalfExtents
} from "./silhouetteGeometry.ts";

export type HighlightBoxSilhouetteOptions = HighlightSilhouetteOptions;

export class BoxSilhouetteShape implements SilhouetteShape {
  #target: THREE.Mesh;

  constructor(
    target: THREE.Mesh
  ) {
    this.#target = target;
  }

  viewFrom(
    localCameraPosition: THREE.Vector3
  ): SilhouetteView {
    const halfExtents = measureHalfExtents(this.#target);
    const faces = computeVisibleFaces(localCameraPosition, halfExtents);

    return {
      key: JSON.stringify([halfExtents.toArray(), faces]),
      build: (rings) => buildSilhouetteGeometry({ ...rings, halfExtents, faces })
    };
  }
}

export class HighlightBoxSilhouette extends HighlightSilhouette {
  constructor(
    options: HighlightBoxSilhouetteOptions
  ) {
    super(new BoxSilhouetteShape(options.target), options);
  }
}
