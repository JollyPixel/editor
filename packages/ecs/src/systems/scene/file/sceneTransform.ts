// Import Internal Dependencies
import {
  mat4,
  quat,
  vec3,
  loadEuler,
  loadQuaternion,
  loadVector3,
  writeEuler,
  writeQuaternion,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  type EulerLike,
  type Mat4,
  type Quat,
  type QuaternionLike,
  type Vector3Like
} from "../../../math.ts";
import type { Transform } from "../../../actor/transform/Transform.ts";
import type {
  SceneTransformFile,
  Vector3JSON
} from "./SceneFile.ts";

export interface SceneTransformPose {
  position: Vector3Like;
  quaternion: QuaternionLike;
  scale: Vector3Like;
}

// CONSTANTS
const kQuaternion = quat.create();
const kPosition = vec3.create();
const kScale = vec3.create();
const kRotation: EulerLike = {
  x: 0,
  y: 0,
  z: 0
};
const kOrientation: QuaternionLike = {
  x: 0,
  y: 0,
  z: 0,
  w: 1
};

export function writeSceneTransform(
  transform: Transform,
  file: SceneTransformFile
): void {
  transform.local.place(
    file.position,
    writeQuaternion(kOrientation, loadFileRotation(file.rotation)),
    file.scale
  );
}

export function localSceneTransform(
  transform: Transform
): SceneTransformFile {
  return readSceneTransform({
    position: transform.local.position,
    quaternion: transform.local.orientation,
    scale: transform.local.scale
  });
}

export function readSceneTransform(
  pose: Readonly<SceneTransformPose>
): SceneTransformFile {
  const { position, scale } = pose;
  const rotation = writeEuler(
    kRotation,
    loadQuaternion(kQuaternion, pose.quaternion)
  );

  return {
    position: {
      x: position.x,
      y: position.y,
      z: position.z
    },
    rotation: {
      x: rotation.x * RADIANS_TO_DEGREES,
      y: rotation.y * RADIANS_TO_DEGREES,
      z: rotation.z * RADIANS_TO_DEGREES
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
  target = mat4.create()
): Mat4 {
  return mat4.fromRotationTranslationScale(
    target,
    loadFileRotation(transform.rotation),
    loadVector3(kPosition, transform.position),
    loadVector3(kScale, transform.scale)
  );
}

function loadFileRotation(
  rotation: Readonly<Vector3JSON>
): Quat {
  kRotation.x = rotation.x * DEGREES_TO_RADIANS;
  kRotation.y = rotation.y * DEGREES_TO_RADIANS;
  kRotation.z = rotation.z * DEGREES_TO_RADIANS;

  return loadEuler(kQuaternion, kRotation);
}
