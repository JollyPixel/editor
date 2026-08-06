// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { GridFadeFrom } from "./shader.ts";
import type { Vector3Like } from "../types.ts";

export class GridFadeValue {
  readonly from: GridFadeFrom;
  /**
   * Target object for `"target"` fade mode.
   * @note
   * Live-swappable.
   */
  target: THREE.Object3D | null;

  constructor(
    from: GridFadeFrom,
    target?: THREE.Object3D
  ) {
    if (from === "target" && !target) {
      throw new Error(
        "GridFadeOptions.target is required when fade.from is \"target\""
      );
    }
    this.from = from;
    this.target = target ?? null;
  }

  /**
   * Updates `targetPositionUniform` from `target`'s world position.
   * Call every frame.
   */
  trackTarget(
    targetPositionUniform: THREE.Vector3
  ): void {
    if (this.from === "target" && this.target) {
      this.target.getWorldPosition(
        targetPositionUniform
      );
    }
  }

  anchorPosition(
    cameraPosition: Vector3Like,
    targetPositionUniform: Vector3Like
  ): Vector3Like {
    return this.from === "target" && this.target ? targetPositionUniform : cameraPosition;
  }
}
