// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { SceneTransformFile } from "./SceneFile.ts";

export interface SceneTransformPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
  scale: THREE.Vector3Like;
}

// CONSTANTS
const kEuler = new THREE.Euler();
const kQuaternion = new THREE.Quaternion();
const kPosition = new THREE.Vector3();
const kScale = new THREE.Vector3();

export function writeSceneTransform(
  object: THREE.Object3D,
  transform: SceneTransformFile
): void {
  const { position, rotation, scale } = transform;

  object.position.set(position.x, position.y, position.z);
  object.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z)
  );
  object.scale.set(scale.x, scale.y, scale.z);
  object.updateMatrixWorld(false);
}

export function readSceneTransform(
  pose: SceneTransformPose
): SceneTransformFile {
  const { position, scale } = pose;
  const rotation = kEuler.setFromQuaternion(
    kQuaternion.copy(pose.quaternion)
  );

  return {
    position: {
      x: position.x,
      y: position.y,
      z: position.z
    },
    rotation: {
      x: THREE.MathUtils.radToDeg(rotation.x),
      y: THREE.MathUtils.radToDeg(rotation.y),
      z: THREE.MathUtils.radToDeg(rotation.z)
    },
    scale: {
      x: scale.x,
      y: scale.y,
      z: scale.z
    }
  };
}

export function composeSceneTransform(
  transform: SceneTransformFile,
  target = new THREE.Matrix4()
): THREE.Matrix4 {
  const { position, rotation, scale } = transform;

  return target.compose(
    kPosition.set(position.x, position.y, position.z),
    kQuaternion.setFromEuler(kEuler.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z)
    )),
    kScale.set(scale.x, scale.y, scale.z)
  );
}
