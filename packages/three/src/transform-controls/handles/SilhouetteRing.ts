// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { AXIS_DIRECTION } from "../../common/axes.ts";
import type { ResolvedRings } from "../appearance.ts";
import { createRingGeometry } from "./geometry.ts";
import type { GizmoView } from "./GizmoHandle.ts";
import { createVisualMaterial } from "./materials.ts";

// CONSTANTS
const kColor = "#9aa2b1";
const kOpacity = 0.7;
const kTubeScale = 0.6;

export interface SilhouetteRingOptions {
  rings: ResolvedRings;
  depthTest: boolean;
  renderOrder: number;
}

export class SilhouetteRing extends THREE.Mesh<
  THREE.TorusGeometry,
  THREE.MeshBasicNodeMaterial
> {
  #disposed = false;

  constructor(
    options: SilhouetteRingOptions
  ) {
    const { rings, depthTest, renderOrder } = options;

    super(
      createRingGeometry(rings.radius, rings.tube * kTubeScale, rings),
      createVisualMaterial({
        color: kColor,
        opacity: kOpacity,
        depthTest
      })
    );

    this.name = "transform-silhouette";
    this.renderOrder = renderOrder;
    this.frustumCulled = false;
  }

  face(
    view: GizmoView
  ): void {
    this.quaternion.setFromUnitVectors(AXIS_DIRECTION.z, view.eye);
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }
}
