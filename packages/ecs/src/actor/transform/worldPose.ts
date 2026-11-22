// Import Internal Dependencies
import {
  mat4,
  quat,
  vec3,
  decomposeMatrix,
  invertMatrix,
  type Mat4,
  type Quat,
  type Vec3
} from "../../math.ts";
import type { TransformPose } from "./TransformPose.ts";

export type WorldAxis = "forward" | "right" | "up";

// CONSTANTS
const kFrame = mat4.create();
const kMatrix = mat4.create();
const kPosition = vec3.create();
const kScale = vec3.create();
const kOrientation = quat.create();
const kParentOrientation = quat.create();
const kRotation = quat.create();
const kAxes: Record<WorldAxis, Vec3> = {
  forward: vec3.fromValues(0, 0, -1),
  right: vec3.fromValues(1, 0, 0),
  up: vec3.fromValues(0, 1, 0)
};

export function worldPosition(
  pose: TransformPose,
  out: Vec3
): Vec3 {
  return mat4.getTranslation(out, pose.globalMatrix());
}

export function worldOrientation(
  pose: TransformPose,
  out: Quat
): Quat {
  decomposeMatrix(pose.globalMatrix(), kPosition, out, kScale);

  return out;
}

export function worldDirection(
  pose: TransformPose,
  out: Vec3,
  axis: WorldAxis
): Vec3 {
  return vec3.transformQuat(
    out,
    kAxes[axis],
    worldOrientation(pose, kOrientation)
  );
}

export function placeInWorld(
  pose: TransformPose,
  matrix: Mat4
): void {
  mat4.multiply(kMatrix, inverseParentFrame(pose), matrix);
  decomposeMatrix(kMatrix, pose.position, pose.quaternion, pose.scale);
  pose.changed();
}

export function moveInWorldTo(
  pose: TransformPose,
  position: Vec3
): void {
  vec3.transformMat4(pose.position, position, inverseParentFrame(pose));
  pose.changed();
}

export function moveInWorld(
  pose: TransformPose,
  offset: Vec3
): void {
  moveInWorldTo(
    pose,
    vec3.add(kPosition, worldPosition(pose, kPosition), offset)
  );
}

export function orientInWorld(
  pose: TransformPose,
  orientation: Quat
): void {
  decomposeMatrix(
    pose.parentFrame(kFrame),
    kPosition,
    kParentOrientation,
    kScale
  );
  quat.multiply(
    pose.quaternion,
    quat.invert(kParentOrientation, kParentOrientation),
    orientation
  );
  pose.changed();
}

export function rotateInWorld(
  pose: TransformPose,
  rotation: Quat
): void {
  orientInWorld(
    pose,
    quat.multiply(kRotation, rotation, worldOrientation(pose, kOrientation))
  );
}

function inverseParentFrame(
  pose: TransformPose
): Mat4 {
  return invertMatrix(kFrame, pose.parentFrame(kFrame));
}
