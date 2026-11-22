// Import Internal Dependencies
import type {
  Mat4,
  Quat,
  Vec3
} from "../../math.ts";

export interface TransformPose {
  readonly position: Vec3;
  readonly quaternion: Quat;
  readonly scale: Vec3;
  changed(): void;
  globalMatrix(): Mat4;
  parentFrame(
    target: Mat4
  ): Mat4;
}
