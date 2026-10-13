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
import { contourTube } from "./contourTube.ts";
import { MeshContour } from "./meshContour.ts";
import { mergeRings } from "./silhouetteGeometry.ts";

export type HighlightMeshSilhouetteOptions = HighlightSilhouetteOptions;

interface ContourSource {
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  version: number;
  generation: number;
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

    const { contour, generation } = this.#contourSource();
    const edges = contour.contourFrom(localCameraPosition);

    return {
      key: `contour:${generation}:${edges.join(",")}`,
      build: (rings) => {
        const chains = contour.chains(edges);
        const inner = rings.innerThickness > 0 ?
          [contourTube(chains, { offset: 0, thickness: rings.innerThickness })] :
          [];
        const outer = contourTube(chains, {
          offset: rings.innerThickness,
          thickness: rings.linewidth
        });

        return mergeRings(inner, [outer], rings);
      }
    };
  }

  #contourSource(): ContourSource {
    const { geometry } = this.#target;
    const position = geometry.getAttribute("position");
    const version = "version" in position ? position.version : position.data.version;
    let source = this.#source;
    if (source === null || source.position !== position || source.version !== version) {
      source = {
        position,
        version,
        generation: (source?.generation ?? 0) + 1,
        contour: new MeshContour(geometry)
      };
      this.#source = source;
    }

    return source;
  }
}

export class HighlightMeshSilhouette extends HighlightSilhouette {
  constructor(
    options: HighlightMeshSilhouetteOptions
  ) {
    super(new MeshSilhouetteShape(options.target), options);
  }
}
