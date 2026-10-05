// Import Third-party Dependencies
import * as THREE from "three";
import {
  voxelCellOf,
  voxelPositionOf,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { castViewRay } from "../../../shared/viewRay.ts";
import { cellFaceStep } from "./cellFaceStep.ts";
import type { BrushPlane } from "../model/BrushFootprint.ts";
import {
  CellFace,
  type FaceAnchors
} from "../model/CellFace.ts";

// CONSTANTS
const kPlane = new THREE.Plane();
const kPlanePoint = new THREE.Vector3();
const kPlaneNormal = new THREE.Vector3();
const kAxisIndex = {
  x: 0,
  y: 1,
  z: 2
} as const;
const kSphere = new THREE.Sphere();
const kSpherePoint = new THREE.Vector3();
const kProbeStep = 1e-4;

export interface BrushAim {
  place: VoxelCoord;
  remove: VoxelCoord;
  face: CellFace | null;
  probe: VoxelCoord | null;
  anchors: FaceAnchors;
}

export interface BrushAimResolverOptions {
  camera: THREE.PerspectiveCamera;
  solid: THREE.Object3D;
  groundPlaneSize: number;
  maxDistance: number;
  skyRadius?: number;
}

export class BrushAimResolver {
  #camera: THREE.PerspectiveCamera;
  #solid: THREE.Object3D;
  #groundPlaneSize: number;
  #maxDistance: number;
  #skyRadius: number;
  #raycaster = new THREE.Raycaster();
  #aim: BrushAim | null = null;
  #aimPointer = new THREE.Vector2(NaN, NaN);
  #aimView = new THREE.Matrix4();

  constructor(
    options: BrushAimResolverOptions
  ) {
    this.#camera = options.camera;
    this.#solid = options.solid;
    this.#groundPlaneSize = options.groundPlaneSize;
    this.#maxDistance = options.maxDistance;
    this.#skyRadius = Math.max(0, options.skyRadius ?? 0);
  }

  get skyRadius(): number {
    return this.#skyRadius;
  }

  set skyRadius(
    value: number
  ) {
    this.#skyRadius = Math.max(0, value);
    this.#aimPointer.set(NaN, NaN);
  }

  invalidate(): void {
    this.#aimPointer.set(NaN, NaN);
  }

  resolve(
    pointer: THREE.Vector2
  ): BrushAim | null {
    if (this.#holdsAim(pointer)) {
      return this.#aim;
    }

    this.#aimPointer.copy(pointer);
    this.#aimView.copy(this.#camera.matrixWorld);
    this.#aim = this.#castAim(pointer);

    return this.#aim;
  }

  #holdsAim(
    pointer: THREE.Vector2
  ): boolean {
    return this.#aimPointer.equals(pointer) &&
      this.#aimView.equals(this.#camera.matrixWorld);
  }

  #castAim(
    pointer: THREE.Vector2
  ): BrushAim | null {
    const hit = castViewRay(this.#camera, this.#solid, {
      pointer,
      groundPlaneSize: this.#groundPlaneSize,
      raycaster: this.#raycaster
    });
    if (
      hit === null ||
      hit.distance > this.#maxDistance
    ) {
      return this.#skyAim();
    }

    if (hit.ground) {
      const ground = voxelPositionOf(
        hit.point,
        hit.normal,
        "front"
      );

      return {
        place: ground,
        remove: ground,
        face: CellFace.NegY,
        probe: null,
        anchors: {
          place: "bottom",
          remove: "bottom"
        }
      };
    }

    const cell = voxelPositionOf(
      hit.point,
      hit.normal,
      "back"
    );

    const face = CellFace.of(
      cellFaceStep(this.#raycaster.ray, cell) ?? hit.normal
    );

    return {
      place: this.#neighbourOf(
        cell,
        hit.point,
        hit.normal
      ),
      remove: cell,
      face,
      probe: probeOf(hit.point, hit.normal),
      anchors: face.anchors
    };
  }

  #skyAim(): BrushAim | null {
    const radius = Math.min(this.#skyRadius, this.#maxDistance);
    if (radius <= 0) {
      return null;
    }

    kSphere.set(this.#camera.position, radius);
    const point = this.#raycaster.ray.intersectSphere(
      kSphere,
      kSpherePoint
    );
    if (point === null) {
      return null;
    }

    const cell = voxelCellOf(point);

    return {
      place: cell,
      remove: cell,
      face: null,
      probe: null,
      anchors: CellFace.FREE_ANCHORS
    };
  }

  aimAtPlane(
    pointer: THREE.Vector2,
    plane: BrushPlane
  ): VoxelCoord | null {
    this.#raycaster.setFromCamera(
      pointer,
      this.#camera
    );
    kPlaneNormal.set(0, 0, 0).setComponent(
      kAxisIndex[plane.axis],
      1
    );
    kPlane.set(kPlaneNormal, -(plane.value + 0.5));

    const point = this.#raycaster.ray.intersectPlane(
      kPlane,
      kPlanePoint
    );
    if (point === null) {
      return null;
    }

    const distance = point.distanceTo(
      this.#raycaster.ray.origin
    );
    if (distance > this.#maxDistance) {
      return null;
    }

    return {
      ...voxelCellOf(point),
      [plane.axis]: plane.value
    };
  }

  #neighbourOf(
    cell: VoxelCoord,
    point: THREE.Vector3,
    normal: THREE.Vector3
  ): VoxelCoord {
    const step = cellFaceStep(
      this.#raycaster.ray,
      cell
    );
    if (step === null) {
      return voxelPositionOf(
        point,
        normal,
        "front"
      );
    }

    return {
      x: cell.x + step.x,
      y: cell.y + step.y,
      z: cell.z + step.z
    };
  }
}

function probeOf(
  point: THREE.Vector3,
  normal: THREE.Vector3
): VoxelCoord {
  return {
    x: point.x - (normal.x * kProbeStep),
    y: point.y - (normal.y * kProbeStep),
    z: point.z - (normal.z * kProbeStep)
  };
}
