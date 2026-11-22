// Import Third-party Dependencies
import {
  mat4,
  quat,
  vec3,
  type EulerLike,
  type Mat4,
  type QuaternionLike,
  type Vector3Like
} from "@jolly-pixel/math";

// Import Internal Dependencies
import type { TransformPose } from "./TransformPose.ts";
import {
  moveInWorld,
  moveInWorldTo,
  orientInWorld,
  placeInWorld,
  rotateInWorld,
  worldDirection,
  worldOrientation,
  worldPosition,
  type WorldAxis
} from "./worldPose.ts";

// CONSTANTS
const kVector = vec3.create();
const kQuaternion = quat.create();

export class GlobalSpace {
  #pose: TransformPose;
  #matrix = mat4.create();
  #position: Vector3Like = {
    x: 0,
    y: 0,
    z: 0
  };
  #orientation: QuaternionLike = {
    x: 0,
    y: 0,
    z: 0,
    w: 1
  };
  #eulerAngles: EulerLike = {
    x: 0,
    y: 0,
    z: 0
  };
  #forward: Vector3Like = {
    x: 0,
    y: 0,
    z: -1
  };
  #right: Vector3Like = {
    x: 1,
    y: 0,
    z: 0
  };
  #up: Vector3Like = {
    x: 0,
    y: 1,
    z: 0
  };

  constructor(
    pose: TransformPose
  ) {
    this.#pose = pose;
  }

  get matrix(): Readonly<Mat4> {
    return mat4.copy(this.#matrix, this.#pose.globalMatrix());
  }

  set matrix(
    value: Readonly<Mat4>
  ) {
    placeInWorld(this.#pose, value);
  }

  get position(): Readonly<Vector3Like> {
    return vec3.write(this.#position, worldPosition(this.#pose, kVector));
  }

  set position(
    value: Readonly<Vector3Like>
  ) {
    moveInWorldTo(this.#pose, vec3.load(kVector, value));
  }

  get orientation(): Readonly<QuaternionLike> {
    return quat.write(
      this.#orientation,
      worldOrientation(this.#pose, kQuaternion)
    );
  }

  set orientation(
    value: Readonly<QuaternionLike>
  ) {
    orientInWorld(this.#pose, quat.load(kQuaternion, value));
  }

  get eulerAngles(): Readonly<EulerLike> {
    return quat.writeEuler(
      this.#eulerAngles,
      worldOrientation(this.#pose, kQuaternion)
    );
  }

  set eulerAngles(
    value: Readonly<EulerLike>
  ) {
    orientInWorld(this.#pose, quat.loadEuler(kQuaternion, value));
  }

  get forward(): Readonly<Vector3Like> {
    return this.#direction(this.#forward, "forward");
  }

  get right(): Readonly<Vector3Like> {
    return this.#direction(this.#right, "right");
  }

  get up(): Readonly<Vector3Like> {
    return this.#direction(this.#up, "up");
  }

  move(
    offset: Readonly<Vector3Like>
  ): this {
    moveInWorld(this.#pose, vec3.load(kVector, offset));

    return this;
  }

  rotate(
    quaternion: Readonly<QuaternionLike>
  ): this {
    rotateInWorld(this.#pose, quat.load(kQuaternion, quaternion));

    return this;
  }

  rotateEulerAngles(
    eulerAngles: Readonly<EulerLike>
  ): this {
    rotateInWorld(this.#pose, quat.loadEuler(kQuaternion, eulerAngles));

    return this;
  }

  #direction(
    out: Vector3Like,
    axis: WorldAxis
  ): Vector3Like {
    return vec3.write(out, worldDirection(this.#pose, kVector, axis));
  }
}
