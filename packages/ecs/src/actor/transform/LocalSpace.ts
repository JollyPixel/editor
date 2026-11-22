// Import Third-party Dependencies
import {
  quat,
  vec3,
  type EulerLike,
  type Quat,
  type QuaternionLike,
  type Vector3Like
} from "@jolly-pixel/math";

// Import Internal Dependencies
import type { TransformPose } from "./TransformPose.ts";

// CONSTANTS
const kRotation = quat.create();
const kOffset = vec3.create();

export class LocalSpace {
  #pose: TransformPose;
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
  #scale: Vector3Like = {
    x: 1,
    y: 1,
    z: 1
  };

  constructor(
    pose: TransformPose
  ) {
    this.#pose = pose;
  }

  get position(): Readonly<Vector3Like> {
    return vec3.write(this.#position, this.#pose.position);
  }

  set position(
    value: Readonly<Vector3Like>
  ) {
    vec3.load(this.#pose.position, value);
    this.#pose.changed();
  }

  get orientation(): Readonly<QuaternionLike> {
    return quat.write(this.#orientation, this.#pose.quaternion);
  }

  set orientation(
    value: Readonly<QuaternionLike>
  ) {
    quat.load(this.#pose.quaternion, value);
    this.#pose.changed();
  }

  get eulerAngles(): Readonly<EulerLike> {
    return quat.writeEuler(this.#eulerAngles, this.#pose.quaternion);
  }

  set eulerAngles(
    value: Readonly<EulerLike>
  ) {
    quat.loadEuler(this.#pose.quaternion, value);
    this.#pose.changed();
  }

  get scale(): Readonly<Vector3Like> {
    return vec3.write(this.#scale, this.#pose.scale);
  }

  set scale(
    value: Readonly<Vector3Like>
  ) {
    vec3.load(this.#pose.scale, value);
    this.#pose.changed();
  }

  place(
    position: Readonly<Vector3Like>,
    quaternion: Readonly<QuaternionLike>,
    scale: Readonly<Vector3Like>
  ): this {
    vec3.load(this.#pose.position, position);
    quat.load(this.#pose.quaternion, quaternion);
    vec3.load(this.#pose.scale, scale);
    this.#pose.changed();

    return this;
  }

  move(
    offset: Readonly<Vector3Like>
  ): this {
    const { position } = this.#pose;
    vec3.add(position, position, vec3.load(kOffset, offset));
    this.#pose.changed();

    return this;
  }

  rotate(
    quaternion: Readonly<QuaternionLike>
  ): this {
    return this.#premultiply(quat.load(kRotation, quaternion));
  }

  rotateEulerAngles(
    eulerAngles: Readonly<EulerLike>
  ): this {
    return this.#premultiply(quat.loadEuler(kRotation, eulerAngles));
  }

  #premultiply(
    rotation: Quat
  ): this {
    const { quaternion } = this.#pose;
    quat.multiply(quaternion, rotation, quaternion);
    this.#pose.changed();

    return this;
  }
}
