// Import Third-party Dependencies
import * as THREE from "three";

export interface MirrorAxes {
  x: boolean;
  y: boolean;
  z: boolean;
}

export function anyMirrorAxis(
  axes: MirrorAxes
): boolean {
  return axes.x || axes.y || axes.z;
}

export function mirrorSignFromAxes(
  axes: MirrorAxes
): THREE.Vector3 {
  return new THREE.Vector3(
    axes.x ? -1 : 1,
    axes.y ? -1 : 1,
    axes.z ? -1 : 1
  );
}

export function mirrorVector(
  vector: THREE.Vector3,
  sign: THREE.Vector3
): THREE.Vector3 {
  return new THREE.Vector3(
    vector.x * sign.x,
    vector.y * sign.y,
    vector.z * sign.z
  );
}

export function mirrorRotation(
  rotation: THREE.Euler,
  sign: THREE.Vector3
): THREE.Euler {
  const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);
  const mirrorMatrix = new THREE.Matrix4().makeScale(sign.x, sign.y, sign.z);
  const mirroredMatrix = mirrorMatrix.clone()
    .multiply(rotationMatrix)
    .multiply(mirrorMatrix);

  const quaternion = new THREE.Quaternion().setFromRotationMatrix(mirroredMatrix);

  return new THREE.Euler().setFromQuaternion(quaternion, rotation.order);
}
