// Import Third-party Dependencies
import * as THREE from "three";

export type TransformLike = Transform | { transform: Transform; };

export class Transform {
  static Matrix = new THREE.Matrix4();
  static Vector3 = new THREE.Vector3();
  static Quaternion = new THREE.Quaternion();

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
    return orientation
      .set(0, 0, 0, 1)
      .multiplyQuaternions(
        this.getParentGlobalOrientation(),
        this.#object3D.quaternion
      );
  }

  getGlobalEulerAngles(
    angles: THREE.Euler = new THREE.Euler()
  ) {
    return angles.setFromQuaternion(
      this.getGlobalOrientation(Transform.Quaternion)
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

  getParentGlobalOrientation() {
    const ancestorOrientation = new THREE.Quaternion();
    let ancestorActor = this.#object3D;
    while (ancestorActor.parent !== null) {
      ancestorActor = ancestorActor.parent;
      ancestorOrientation.multiplyQuaternions(
        ancestorActor.quaternion,
        ancestorOrientation
      );
    }

    return ancestorOrientation;
  }

  setGlobalMatrix(
    matrix: THREE.Matrix4
  ) {
    if (!this.#object3D.parent) {
      return this;
    }

    matrix.multiplyMatrices(
      new THREE.Matrix4()
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

    const localPos = Transform.Vector3.copy(pos);
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
    const localMatrix4 = new THREE.Matrix4();
    const resolvedTarget = target instanceof Transform || "transform" in target
      ? Transform.resolveTransform(target).getGlobalPosition(new THREE.Vector3())
      : target;
    const targetVec = new THREE.Vector3().copy(resolvedTarget);
    const upVec = up ?
      new THREE.Vector3().copy(up) :
      this.#object3D.up;
    localMatrix4.lookAt(
      this.getGlobalPosition(Transform.Vector3),
      targetVec,
      upVec
    );
    this.setGlobalOrientation(Transform.Quaternion.setFromRotationMatrix(localMatrix4));

    return this;
  }

  lookTowards(
    direction: THREE.Vector3Like,
    up?: THREE.Vector3Like
  ) {
    this.lookAt(
      this.getGlobalPosition(Transform.Vector3).sub(direction),
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

    const localQuaternion = new THREE.Quaternion()
      .copy(quaternion);
    const inverseParentQuaternion = new THREE.Quaternion()
      .setFromRotationMatrix(
        Transform.Matrix.extractRotation(
          this.#object3D.parent.matrixWorld
        )
      )
      .invert();
    localQuaternion.multiplyQuaternions(
      inverseParentQuaternion,
      localQuaternion
    );
    this.#object3D.quaternion.copy(localQuaternion);
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
    if (!this.#object3D.parent) {
      return this;
    }

    const globalQuaternion = new THREE.Quaternion()
      .setFromEuler(eulerAngles);
    const inverseParentQuaternion = new THREE.Quaternion()
      .setFromRotationMatrix(
        Transform.Matrix.extractRotation(
          this.#object3D.parent.matrixWorld
        )
      )
      .invert();
    globalQuaternion.multiplyQuaternions(
      inverseParentQuaternion,
      globalQuaternion
    );
    this.#object3D.quaternion.copy(globalQuaternion);
    this.#object3D.updateMatrixWorld(false);

    return this;
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
    this.getGlobalOrientation(Transform.Quaternion);
    const rotation = new THREE.Quaternion().copy(quaternion);
    rotation.multiply(Transform.Quaternion);
    this.setGlobalOrientation(rotation);

    return this;
  }

  rotateLocal(
    quaternion: THREE.QuaternionLike
  ) {
    const rotation = new THREE.Quaternion().copy(quaternion);
    rotation.multiply(this.#object3D.quaternion);
    this.#object3D.quaternion.copy(rotation);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  rotateGlobalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    const quaternion = new THREE.Quaternion()
      .setFromEuler(eulerAngles);
    this.rotateGlobal(quaternion);

    return this;
  }

  rotateLocalEulerAngles(
    eulerAngles: THREE.Euler
  ) {
    const quaternion = new THREE.Quaternion()
      .setFromEuler(eulerAngles);
    quaternion.multiply(this.#object3D.quaternion);
    this.#object3D.quaternion.copy(quaternion);
    this.#object3D.updateMatrixWorld(false);

    return this;
  }

  moveGlobal(
    offset: THREE.Vector3Like
  ) {
    this.getGlobalPosition(Transform.Vector3).add(offset);
    this.setGlobalPosition(Transform.Vector3);

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
    const orientedOffset = new THREE.Vector3()
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
        this.getGlobalOrientation(Transform.Quaternion)
      );
  }

  getRight(
    target: THREE.Vector3 = new THREE.Vector3()
  ) {
    return target
      .set(1, 0, 0)
      .applyQuaternion(
        this.getGlobalOrientation(Transform.Quaternion)
      );
  }

  getUp(
    target: THREE.Vector3 = new THREE.Vector3()
  ) {
    return target
      .set(0, 1, 0)
      .applyQuaternion(
        this.getGlobalOrientation(Transform.Quaternion)
      );
  }

  moveForward(
    distance: number
  ) {
    return this.moveGlobal(
      this.getForward(Transform.Vector3).multiplyScalar(distance)
    );
  }

  moveRight(
    distance: number
  ) {
    return this.moveGlobal(
      this.getRight(Transform.Vector3).multiplyScalar(distance)
    );
  }

  moveUp(
    distance: number
  ) {
    return this.moveGlobal(
      this.getUp(Transform.Vector3).multiplyScalar(distance)
    );
  }

  distanceTo(
    other: TransformLike
  ) {
    this.getGlobalPosition(Transform.Vector3);
    const otherPos = Transform
      .resolveTransform(other)
      .getGlobalPosition(new THREE.Vector3());

    return Transform.Vector3.distanceTo(otherPos);
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
