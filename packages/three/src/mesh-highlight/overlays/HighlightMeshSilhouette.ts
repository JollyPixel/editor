// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightSilhouette,
  type HighlightSilhouetteOptions,
  type SilhouetteShape,
  type SilhouetteView
} from "./HighlightSilhouette.ts";
import { BoxSilhouetteShape } from "./HighlightBoxSilhouette.ts";
import {
  MeshContour,
  positionVersion
} from "./meshContour.ts";

export type HighlightMeshSilhouetteOptions = HighlightSilhouetteOptions;

interface ContourSource {
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  version: number;
  contour: MeshContour;
}

class MeshSilhouetteShape implements SilhouetteShape {
  #target: THREE.Mesh;
  #box: BoxSilhouetteShape;
  #source: ContourSource | null = null;

  constructor(
    target: THREE.Mesh
  ) {
    this.#target = target;
    this.#box = new BoxSilhouetteShape(target);
  }

  viewFrom(
    localCameraPosition: THREE.Vector3
  ): SilhouetteView {
    if (this.#target.geometry instanceof THREE.BoxGeometry) {
      const view = this.#box.viewFrom(localCameraPosition);

      return {
        ...view,
        key: `box:${view.key}`
      };
    }

    return this.#contour().viewFrom(localCameraPosition);
  }

  #contour(): MeshContour {
    const { geometry } = this.#target;
    const position = geometry.getAttribute("position");
    const version = positionVersion(position);
    const source = this.#source;
    if (source?.position === position && source.version === version) {
      return source.contour;
    }

    const contour = new MeshContour(geometry);
    this.#source = {
      position,
      version,
      contour
    };

    return contour;
  }
}

export class HighlightMeshSilhouette extends HighlightSilhouette {
  constructor(
    options: HighlightMeshSilhouetteOptions
  ) {
    super(new MeshSilhouetteShape(options.target), options);
  }
}
