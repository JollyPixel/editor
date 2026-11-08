// Import Internal Dependencies
import type {
  Matrix4,
  Quaternion,
  Vector3
} from "../../math.ts";

export interface TransformPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
  changed(): void;
  globalMatrix(): Readonly<Matrix4>;
  parentFrame(
    target: Matrix4
  ): Matrix4;
}
