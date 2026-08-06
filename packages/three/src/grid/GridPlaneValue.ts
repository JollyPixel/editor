// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Vector3Like } from "../types.ts";

export type GridPlane = "xz" | "xy" | "yz";

export interface PlaneAxes {
  u: "x" | "y" | "z";
  v: "x" | "y" | "z";
  normal: "x" | "y" | "z";
}

// CONSTANTS
const kValidPlanes: GridPlane[] = ["xz", "xy", "yz"];
const kPlaneAxes: Record<GridPlane, PlaneAxes> = {
  xz: { u: "x", v: "z", normal: "y" },
  xy: { u: "x", v: "y", normal: "z" },
  yz: { u: "y", v: "z", normal: "x" }
};

export function getPlaneAxes(
  plane: GridPlane
): PlaneAxes {
  return kPlaneAxes[plane];
}

export class GridPlaneValue {
  readonly value: GridPlane;

  constructor(
    value: GridPlane
  ) {
    if (!kValidPlanes.includes(value)) {
      throw new Error(`Invalid plane "${value}"`);
    }
    this.value = value;
  }

  clone(): GridPlaneValue {
    return new GridPlaneValue(this.value);
  }

  orientGeometry(
    geometry: THREE.PlaneGeometry
  ): void {
    switch (this.value) {
      case "xz":
        geometry.rotateX(-Math.PI / 2);
        break;
      case "yz":
        geometry.rotateY(Math.PI / 2);
        break;
      case "xy":
      default:
        break;
    }
  }

  followPosition(
    cameraPosition: Vector3Like,
    normalOffset: number
  ): Vector3Like {
    const { u, v, normal } = kPlaneAxes[this.value];

    const result = {
      x: 0,
      y: 0,
      z: 0
    };
    result[u] = cameraPosition[u];
    result[v] = cameraPosition[v];
    result[normal] = normalOffset;

    return result;
  }
}
