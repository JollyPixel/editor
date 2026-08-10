// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { GridFadeFrom } from "./shader.ts";
import type { Vector3Like } from "../types.ts";

export class GridFadeValue {
  readonly from: GridFadeFrom;
  /** Target for `"target"` mode. Set to `null` to use `trackTarget`'s fallback. */
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
   * Copies the target's world position, or the fallback when cleared.
   */
  trackTarget(
    targetPositionUniform: THREE.Vector3,
    fallbackPosition?: Vector3Like
  ): void {
    if (this.from === "target" && this.target) {
      this.target.getWorldPosition(
        targetPositionUniform
      );
    }
    else if (this.from === "target" && fallbackPosition) {
      targetPositionUniform.set(
        fallbackPosition.x,
        fallbackPosition.y,
        fallbackPosition.z
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
