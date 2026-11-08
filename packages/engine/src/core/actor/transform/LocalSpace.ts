// Import Internal Dependencies
import {
  Euler,
  Quaternion,
  Vector3,
  type QuaternionLike,
  type Vector3Like
} from "../../math.ts";
import type { TransformPose } from "./TransformPose.ts";

// CONSTANTS
const kRotation = new Quaternion();

export class LocalSpace {
  #pose: TransformPose;
  #position = new Vector3();
  #orientation = new Quaternion();
  #eulerAngles = new Euler();
  #scale = new Vector3();

  constructor(
    pose: TransformPose
  ) {
    this.#pose = pose;
  }

  get position(): Readonly<Vector3> {
    return this.#position.copy(this.#pose.position);
  }

  set position(
    value: Vector3Like
  ) {
    this.#pose.position.copy(value);
    this.#pose.changed();
  }

  get orientation(): Readonly<Quaternion> {
    return this.#orientation.copy(this.#pose.quaternion);
  }

  set orientation(
    value: QuaternionLike
  ) {
    this.#pose.quaternion.copy(value);
    this.#pose.changed();
  }

  get eulerAngles(): Readonly<Euler> {
    return this.#eulerAngles.setFromQuaternion(this.#pose.quaternion);
  }

  set eulerAngles(
    value: Euler
  ) {
    this.#pose.quaternion.setFromEuler(value);
    this.#pose.changed();
  }

  get scale(): Readonly<Vector3> {
    return this.#scale.copy(this.#pose.scale);
  }

  set scale(
    value: Vector3Like
  ) {
    this.#pose.scale.copy(value);
    this.#pose.changed();
  }

  place(
    position: Vector3Like,
    quaternion: QuaternionLike,
    scale: Vector3Like
  ): this {
    this.#pose.position.copy(position);
    this.#pose.quaternion.copy(quaternion);
    this.#pose.scale.copy(scale);
    this.#pose.changed();

    return this;
  }

  move(
    offset: Vector3Like
  ): this {
    this.#pose.position.add(offset);
    this.#pose.changed();

    return this;
  }

  rotate(
    quaternion: QuaternionLike
  ): this {
    this.#pose.quaternion.premultiply(kRotation.copy(quaternion));
    this.#pose.changed();

    return this;
  }

  rotateEulerAngles(
    eulerAngles: Euler
  ): this {
    return this.rotate(kRotation.setFromEuler(eulerAngles));
  }
}
