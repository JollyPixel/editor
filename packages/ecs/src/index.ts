// Import Third-party Dependencies
import {
  Input,
  InputCombination,
  Axis,
  AxisMap,
  type InputDevicePreference,
  type InputCondition,
  type AxisSource
} from "@jolly-pixel/controls";

export * as Systems from "./systems/index.ts";
export type { SceneBackend } from "./systems/SceneBackend.ts";
export * from "./components/index.ts";
export * from "./actor/index.ts";
export * from "./utils/index.ts";
export * as Types from "./types.ts";
export type {
  EulerLike,
  Mat4,
  Quat,
  QuaternionLike,
  Vec3,
  Vector2Like,
  Vector3Like,
  Vector4Like
} from "./math.ts";
export {
  decomposeMatrix,
  loadMatrix,
  loadQuaternion,
  loadVector3,
  writeQuaternion,
  writeVector3
} from "./math.ts";

export {
  Input,
  InputCombination,
  Axis,
  AxisMap
};

export type {
  InputDevicePreference,
  InputCondition,
  AxisSource
};
