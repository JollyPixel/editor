// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { isVisibleInHierarchy } from "../utils/isVisibleInHierarchy.ts";

// CONSTANTS
const kMatrix = new THREE.Matrix4();
const kTarget = new THREE.Vector3();
const kUp = new THREE.Vector3();
const kOffset = new THREE.Vector3();
const kOther = new THREE.Vector3();
const kParentOrientation = new THREE.Quaternion();
const kRotation = new THREE.Quaternion();
const kEulerRotation = new THREE.Quaternion();
const kPosition = new THREE.Vector3();
const kLocalPosition = new THREE.Vector3();
const kDirection = new THREE.Vector3();
const kOrientation = new THREE.Quaternion();
const kTargetOrientation = new THREE.Quaternion();

export type TransformLike = Transform | { transform: Transform; };

export class Transform {
  static resolveTransform(
    value: TransformLike
  ): Transform {
    return value instanceof Transform ? value : value.transform;
  }

  #object3D: THREE.Object3D;

  constructor(
    object3D: THREE.Object3D
  ) {
    this.#object3D = object3D;
  }

  getVisible() {
    return this.#object3D.visible;
  }

  setVisible(
    visible: boolean
  ) {
    this.#object3D.visible = visible;

    return this;
  }

  get visibleInHierarchy(): boolean {
    return isVisibleInHierarchy(this.#object3D);
  }

  getGlobalMatrix(
    matrix: THREE.Matrix4 = new THREE.Matrix4()
  ) {
    return matrix.copy(this.#object3D.matrixWorld);
  }

  getGlobalPosition(
    position: THREE.Vector3 = new THREE.Vector3()
  ) {
    return position.setFromMatrixPosition(
      this.#object3D.matrixWorld
    );
  }

  getGlobalOrientation(
    orientation: THREE.Quaternion = new THREE.Quaternion()
  ) {
    return this.#object3D.getWorldQuaternion(orientation);
  }

  getGlobalEulerAngles(
    angles: THREE.Euler = new THREE.Euler()
  ) {
    return angles.setFromQuaternion(
      this.getGlobalOrientation(kOrientation)
    );
  }

  getLocalPosition(
    position: THREE.Vector3 = new THREE.Vector3()
  ) {
    return position.copy(this.#object3D.position);
  }

  getLocalOrientation(
    orientation: THREE.Quaternion = new THREE.Quaternion()
  ) {
    return orientation.copy(this.#object3D.quaternion);
  }

  getLocalEulerAngles(
    angles: THREE.Euler = new THREE.Euler()
  ) {
    return angles.setFromQuaternion(this.#object3D.quaternion);
  }

  getLocalScale(
    scale: THREE.Vector3 = new THREE.Vector3()
  ) {
    return scale.copy(this.#object3D.scale);
  }

  getParentGlobalOrientation(
    orientation: THREE.Quaternion = new THREE.Quaternion()
  ) {
    const parent = this.#object3D.parent;

    return parent === null ?
      orientation.identity() :
      parent.getWorldQuaternion(orientation);
  }

  setGlobalMatrix(
    matrix: THREE.Matrix4
  ) {
    if (!this.#object3D.parent) {
      return this;
    }

    matrix.multiplyMatrices(
      kMatrix
        .copy(this.#object3D.parent.matrixWorld)
        .invert(),
      matrix
    );
    matrix.decompose(
      this.#object3D.position,
      this.#object3D.quaternion,
      this.#object3D.scale
    );
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  setGlobalPosition(
    pos: THREE.Vector3Like
  ) {
    if (!this.#object3D.parent) {
      return this;
    }

    const localPos = kLocalPosition.copy(pos);
    this.#object3D.parent.worldToLocal(localPos);
    this.#object3D.position.copy(localPos);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  setLocalPosition(
    pos: THREE.Vector3Like
  ) {
    this.#object3D.position.copy(pos);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  lookAt(
    target: TransformLike | THREE.Vector3Like,
    up?: THREE.Vector3Like
  ) {
    const targetVec = target instanceof Transform || "transform" in target
      ? Transform.resolveTransform(target).getGlobalPosition(kTarget)
      : kTarget.copy(target);
    const upVec = up ?
      kUp.copy(up) :
      this.#object3D.up;
    kMatrix.lookAt(
      this.getGlobalPosition(kPosition),
      targetVec,
      upVec
    );
    this.setGlobalOrientation(kOrientation.setFromRotationMatrix(kMatrix));

    return this;
  }

  lookTowards(
    direction: THREE.Vector3Like,
    up?: THREE.Vector3Like
  ) {
    this.lookAt(
      this.getGlobalPosition(kPosition).sub(direction),
      up
    );

    return this;
  }

  setLocalOrientation(
    quaternion: THREE.QuaternionLike
  ) {
    this.#object3D.quaternion.copy(quaternion);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  setGlobalOrientation(
    quaternion: THREE.QuaternionLike
  ) {
    if (!this.#object3D.parent) {
      return this;
    }

    this.#object3D.quaternion.multiplyQuaternions(
      this.getParentGlobalOrientation(kParentOrientation).invert(),
      kTargetOrientation.copy(quaternion)
    );
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  setLocalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    this.#object3D.quaternion.setFromEuler(eulerAngles);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  setGlobalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    return this.setGlobalOrientation(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  setLocalScale(
    scale: THREE.Vector3Like
  ) {
    this.#object3D.scale.copy(scale);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  rotateGlobal(
    quaternion: THREE.QuaternionLike
  ) {
    const rotation = kRotation
      .copy(quaternion)
      .multiply(this.getGlobalOrientation(kOrientation));
    this.setGlobalOrientation(rotation);

    return this;
  }

  rotateLocal(
    quaternion: THREE.QuaternionLike
  ) {
    this.#object3D.quaternion.premultiply(
      kTargetOrientation.copy(quaternion)
    );
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  rotateGlobalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    return this.rotateGlobal(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  rotateLocalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    return this.rotateLocal(
      kEulerRotation.setFromEuler(eulerAngles)
    );
  }

  moveGlobal(
    offset: THREE.Vector3Like
  ) {
    this.setGlobalPosition(
      this.getGlobalPosition(kPosition).add(offset)
    );

    return this;
  }

  moveLocal(
    offset: THREE.Vector3Like
  ) {
    this.#object3D.position.add(offset);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  moveOriented(
    offset: THREE.Vector3Like
  ) {
    const orientedOffset = kOffset
      .copy(offset)
      .applyQuaternion(this.#object3D.quaternion);
    this.#object3D.position.add(orientedOffset);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  getForward(
    target: THREE.Vector3 = new THREE.Vector3()
  ) {
    return target
      .set(0, 0, -1)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  getRight(
    target: THREE.Vector3 = new THREE.Vector3()
  ) {
    return target
      .set(1, 0, 0)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  getUp(
    target: THREE.Vector3 = new THREE.Vector3()
  ) {
    return target
      .set(0, 1, 0)
      .applyQuaternion(
        this.getGlobalOrientation(kOrientation)
      );
  }

  moveForward(
    distance: number
  ) {
    return this.moveGlobal(
      this.getForward(kDirection).multiplyScalar(distance)
    );
  }

  moveRight(
    distance: number
  ) {
    return this.moveGlobal(
      this.getRight(kDirection).multiplyScalar(distance)
    );
  }

  moveUp(
    distance: number
  ) {
    return this.moveGlobal(
      this.getUp(kDirection).multiplyScalar(distance)
    );
  }

  distanceTo(
    other: TransformLike
  ) {
    const otherPos = Transform
      .resolveTransform(other)
      .getGlobalPosition(kOther);

    return this.getGlobalPosition(kPosition).distanceTo(otherPos);
  }

  lerpPosition(
    target: THREE.Vector3Like,
    alpha: number
  ) {
    this.#object3D.position.lerp(target as THREE.Vector3, alpha);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  slerpOrientation(
    target: THREE.QuaternionLike,
    alpha: number
  ) {
    this.#object3D.quaternion.slerp(target as THREE.Quaternion, alpha);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }
}
