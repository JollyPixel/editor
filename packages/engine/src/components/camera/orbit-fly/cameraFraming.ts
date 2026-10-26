// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { CameraPose } from "./OrbitFlyCamera.ts";

export interface CameraFramingOptions {
  /**
   * Direction the framed camera looks in.
   */
  forward: THREE.Vector3Like;
  /**
   * Vertical field of view, in degrees.
   */
  fov: number;
  /**
   * Multiplier applied to the distance that fits the bounding sphere.
   * @default 1.2
   */
  margin?: number;
  /**
   * @default 0
   */
  minDistance?: number;
  /**
   * @default Infinity
   */
  maxDistance?: number;
}

// CONSTANTS
const kUp = new THREE.Vector3(0, 1, 0);
const kDefaultMargin = 1.2;

export function frameBounds(
  bounds: THREE.Box3,
  options: CameraFramingOptions
): CameraPose {
  const {
    forward,
    fov,
    margin = kDefaultMargin,
    minDistance = 0,
    maxDistance = Infinity
  } = options;

  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(
    bounds.getBoundingSphere(new THREE.Sphere()).radius,
    0
  );
  const halfFov = THREE.MathUtils.degToRad(fov) / 2;
  const distance = THREE.MathUtils.clamp(
    (radius / Math.sin(halfFov)) * margin,
    minDistance,
    maxDistance
  );
  const direction = new THREE.Vector3()
    .copy(forward)
    .normalize();
  const position = center.clone().addScaledVector(direction, -distance);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, center, kUp)
  );

  return {
    position,
    quaternion
  };
}
