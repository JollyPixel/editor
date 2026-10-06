// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kUp = new THREE.Vector3(0, 1, 0);
const kOrigin = new THREE.Vector3();
const kViewDirection = new THREE.Vector3(0, 0.6, 1).normalize();
const kDefaultFov = 60;
const kDefaultMinDistance = 16;
const kDefaultMaxDistance = 64;
const kFramingMargin = 1.2;

export interface SpawnLayer {
  readonly visible: boolean;
  worldBounds(): THREE.Box3 | null;
}

export interface SpawnPoseOptions {
  /**
   * Vertical field of view, in degrees.
   * @default 60
   */
  fov?: number;
  /**
   * Camera distance bounds from the framed target, in world units.
   */
  minDistance?: number;
  maxDistance?: number;
}

export class SpawnPose {
  static frame(
    layers: Iterable<SpawnLayer>,
    options: SpawnPoseOptions = {}
  ): SpawnPose {
    const {
      fov = kDefaultFov,
      minDistance = kDefaultMinDistance,
      maxDistance = kDefaultMaxDistance
    } = options;

    const bounds = SpawnPose.#nearestBounds(layers);
    const target = bounds?.getCenter(new THREE.Vector3()) ??
      new THREE.Vector3();
    const radius = bounds?.getBoundingSphere(
      new THREE.Sphere()
    ).radius ?? 0;

    const halfFov = THREE.MathUtils.degToRad(fov) / 2;
    const distance = THREE.MathUtils.clamp(
      (radius / Math.sin(halfFov)) * kFramingMargin,
      minDistance,
      maxDistance
    );

    return new SpawnPose(
      target.clone().addScaledVector(
        kViewDirection,
        distance
      ),
      target
    );
  }

  static #nearestBounds(
    layers: Iterable<SpawnLayer>
  ): THREE.Box3 | null {
    let nearest: THREE.Box3 | null = null;
    let nearestDistance = Infinity;

    for (const layer of layers) {
      if (!layer.visible) {
        continue;
      }

      const bounds = layer.worldBounds();
      if (bounds === null) {
        continue;
      }

      const distance = bounds.distanceToPoint(kOrigin);
      if (distance < nearestDistance) {
        nearest = bounds;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;

  constructor(
    position: THREE.Vector3Like,
    target: THREE.Vector3Like
  ) {
    this.position = new THREE.Vector3()
      .copy(position);
    this.target = new THREE.Vector3()
      .copy(target);

    this.quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        this.position,
        this.target,
        kUp
      )
    );
  }
}
