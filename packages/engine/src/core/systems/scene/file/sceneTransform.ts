// Import Internal Dependencies
import {
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type QuaternionLike,
  type Vector3Like
} from "../../../math.ts";
import type { Transform } from "../../../actor/transform/Transform.ts";
import type { SceneTransformFile } from "./SceneFile.ts";

export interface SceneTransformPose {
  position: Vector3Like;
  quaternion: QuaternionLike;
  scale: Vector3Like;
}

// CONSTANTS
const kEuler = new Euler();
const kQuaternion = new Quaternion();
const kPosition = new Vector3();
const kScale = new Vector3();

export function writeSceneTransform(
  transform: Transform,
  file: SceneTransformFile
): void {
  loadFilePose(file);
  transform.local.place(kPosition, kQuaternion, kScale);
}

export function localSceneTransform(
  transform: Transform
): SceneTransformFile {
  return readSceneTransform({
    position: kPosition.copy(transform.local.position),
    quaternion: kQuaternion.copy(transform.local.orientation),
    scale: kScale.copy(transform.local.scale)
  });
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
      x: MathUtils.radToDeg(rotation.x),
      y: MathUtils.radToDeg(rotation.y),
      z: MathUtils.radToDeg(rotation.z)
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
  target = new Matrix4()
): Matrix4 {
  loadFilePose(transform);

  return target.compose(kPosition, kQuaternion, kScale);
}

function loadFilePose(
  file: SceneTransformFile
): void {
  const { position, rotation, scale } = file;

  kPosition.set(position.x, position.y, position.z);
  kQuaternion.setFromEuler(kEuler.set(
    MathUtils.degToRad(rotation.x),
    MathUtils.degToRad(rotation.y),
    MathUtils.degToRad(rotation.z)
  ));
  kScale.set(scale.x, scale.y, scale.z);
}
