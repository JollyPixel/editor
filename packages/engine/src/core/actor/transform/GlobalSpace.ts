// Import Internal Dependencies
import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type QuaternionLike,
  type Vector3Like
} from "../../math.ts";
import type { TransformPose } from "./TransformPose.ts";

// CONSTANTS
const kFrame = new Matrix4();
const kMatrix = new Matrix4();
const kPosition = new Vector3();
const kScale = new Vector3();
const kMoved = new Vector3();
const kOrientation = new Quaternion();
const kParentOrientation = new Quaternion();
const kTargetOrientation = new Quaternion();
const kRotation = new Quaternion();

export class GlobalSpace {
  #pose: TransformPose;
  #matrix = new Matrix4();
  #position = new Vector3();
  #orientation = new Quaternion();
  #eulerAngles = new Euler();
  #forward = new Vector3();
  #right = new Vector3();
  #up = new Vector3();

  constructor(
    pose: TransformPose
  ) {
    this.#pose = pose;
  }

  get matrix(): Readonly<Matrix4> {
    return this.#matrix.copy(this.#pose.globalMatrix());
  }

  set matrix(
    value: Readonly<Matrix4>
  ) {
    const { position, quaternion, scale } = this.#pose;
    kMatrix
      .multiplyMatrices(this.#pose.parentFrame(kFrame).invert(), value)
      .decompose(position, quaternion, scale);
    this.#pose.changed();
  }

  get position(): Readonly<Vector3> {
    return this.#position.setFromMatrixPosition(this.#pose.globalMatrix());
  }

  set position(
    value: Vector3Like
  ) {
    this.#pose.position
      .copy(value)
      .applyMatrix4(this.#pose.parentFrame(kFrame).invert());
    this.#pose.changed();
  }

  get orientation(): Readonly<Quaternion> {
    return this.#decomposeOrientation(this.#orientation);
  }

  set orientation(
    value: QuaternionLike
  ) {
    this.#pose.parentFrame(kFrame).decompose(kPosition, kParentOrientation, kScale);
    this.#pose.quaternion.multiplyQuaternions(
      kParentOrientation.invert(),
      kTargetOrientation.copy(value)
    );
    this.#pose.changed();
  }

  get eulerAngles(): Readonly<Euler> {
    return this.#eulerAngles.setFromQuaternion(
      this.#decomposeOrientation(kOrientation)
    );
  }

  set eulerAngles(
    value: Euler
  ) {
    this.orientation = kRotation.setFromEuler(value);
  }

  get forward(): Readonly<Vector3> {
    return this.#forward
      .set(0, 0, -1)
      .applyQuaternion(this.#decomposeOrientation(kOrientation));
  }

  get right(): Readonly<Vector3> {
    return this.#right
      .set(1, 0, 0)
      .applyQuaternion(this.#decomposeOrientation(kOrientation));
  }

  get up(): Readonly<Vector3> {
    return this.#up
      .set(0, 1, 0)
      .applyQuaternion(this.#decomposeOrientation(kOrientation));
  }

  move(
    offset: Vector3Like
  ): this {
    this.position = kMoved.copy(this.position).add(offset);

    return this;
  }

  rotate(
    quaternion: QuaternionLike
  ): this {
    this.orientation = kRotation
      .copy(quaternion)
      .multiply(this.orientation);

    return this;
  }

  rotateEulerAngles(
    eulerAngles: Euler
  ): this {
    return this.rotate(kRotation.setFromEuler(eulerAngles));
  }

  #decomposeOrientation(
    target: Quaternion
  ): Quaternion {
    this.#pose.globalMatrix().decompose(kPosition, target, kScale);

    return target;
  }
}
