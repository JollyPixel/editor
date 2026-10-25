// Import Third-party Dependencies
import * as THREE from "three";
import type {
  CameraPose,
  OrbitFlyCamera
} from "@jolly-pixel/engine";

// CONSTANTS
const kMinRadius = 0.5;
const kMargin = 1.4;

export function framePose(
  bounds: THREE.Box3,
  forward: THREE.Vector3Like,
  fov: number
): CameraPose {
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(
    bounds.getBoundingSphere(new THREE.Sphere()).radius,
    kMinRadius
  );
  const distance = (radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2)) * kMargin;
  const direction = new THREE.Vector3(forward.x, forward.y, forward.z).normalize();
  const position = center.clone().addScaledVector(direction, -distance);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, center, new THREE.Vector3(0, 1, 0))
  );

  return {
    position,
    quaternion
  };
}

export function frameObjects(
  camera: OrbitFlyCamera,
  objects: Iterable<THREE.Object3D>
): void {
  const bounds = new THREE.Box3();
  for (const object of objects) {
    bounds.expandByObject(object);
    bounds.expandByPoint(object.getWorldPosition(new THREE.Vector3()));
  }
  if (bounds.isEmpty()) {
    return;
  }

  camera.exitOrbitFocus();
  camera.teleport(framePose(
    bounds,
    camera.camera.getWorldDirection(new THREE.Vector3()),
    camera.camera.fov
  ));
}
