// Import Third-party Dependencies
import * as THREE from "three";

export class Transform {
  static Matrix = new THREE.Matrix4();
  static Vector3 = new THREE.Vector3();
  static Quaternion = new THREE.Quaternion();

  threeObject: THREE.Object3D;

  constructor(threeObject: THREE.Object3D) {
    this.threeObject = threeObject;
  }

  getVisible() {
    return this.threeObject.visible;
  }

  setVisible(visible: boolean) {
    this.threeObject.visible = visible;

    return this;
  }

  getGlobalMatrix(matrix: THREE.Matrix4) {
    return matrix.copy(this.threeObject.matrixWorld);
  }
  getGlobalPosition(position: THREE.Vector3) {
    return position.setFromMatrixPosition(this.threeObject.matrixWorld);
  }
  getGlobalOrientation(orientation: THREE.Quaternion) {
    return orientation
      .set(0, 0, 0, 1)
      .multiplyQuaternions(
        this.getParentGlobalOrientation(),
        this.threeObject.quaternion
      );
  }
  getGlobalEulerAngles(angles: THREE.Euler) {
    return angles.setFromQuaternion(this.getGlobalOrientation(Transform.Quaternion));
  }
  getLocalPosition(position: THREE.Vector3) {
    return position.copy(this.threeObject.position);
  }
  getLocalOrientation(orientation: THREE.Quaternion) {
    return orientation.copy(this.threeObject.quaternion);
  }
  getLocalEulerAngles(angles: THREE.Euler) {
    return angles.setFromQuaternion(this.threeObject.quaternion);
  }
  getLocalScale(scale: THREE.Vector3) {
    return scale.copy(this.threeObject.scale);
  }

  getParentGlobalOrientation() {
    const ancestorOrientation = new THREE.Quaternion();
    let ancestorActor = this.threeObject;
    while (ancestorActor.parent !== null) {
      ancestorActor = ancestorActor.parent;
      ancestorOrientation.multiplyQuaternions(ancestorActor.quaternion, ancestorOrientation);
    }

    return ancestorOrientation;
  }

  setGlobalMatrix(matrix: THREE.Matrix4) {
    if (!this.threeObject.parent) {
      return;
    }

    matrix.multiplyMatrices(
      new THREE.Matrix4().copy(this.threeObject.parent.matrixWorld).invert(),
      matrix
    );
    matrix.decompose(this.threeObject.position, this.threeObject.quaternion, this.threeObject.scale);
    this.threeObject.updateMatrixWorld(false);
  }

  setGlobalPosition(pos: THREE.Vector3) {
    if (!this.threeObject.parent) {
      return;
    }

    this.threeObject.parent.worldToLocal(pos);
    this.threeObject.position.set(pos.x, pos.y, pos.z);
    this.threeObject.updateMatrixWorld(false);
  }

  setLocalPosition(pos: THREE.Vector3) {
    this.threeObject.position.copy(pos);
    this.threeObject.updateMatrixWorld(false);
  }

  lookAt(target: THREE.Vector3, up = this.threeObject.up) {
    const m = new THREE.Matrix4();
    m.lookAt(this.getGlobalPosition(Transform.Vector3), target, up);
    this.setGlobalOrientation(Transform.Quaternion.setFromRotationMatrix(m));
  }

  lookTowards(direction: THREE.Vector3, up?: THREE.Vector3) {
    this.lookAt(this.getGlobalPosition(Transform.Vector3).sub(direction), up);
  }

  setLocalOrientation(quaternion: THREE.Quaternion) {
    this.threeObject.quaternion.copy(quaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  setGlobalOrientation(quaternion: THREE.Quaternion) {
    if (!this.threeObject.parent) {
      return;
    }

    const inverseParentQuaternion = new THREE.Quaternion()
      .setFromRotationMatrix(Transform.Matrix.extractRotation(this.threeObject.parent.matrixWorld))
      .invert();
    quaternion.multiplyQuaternions(inverseParentQuaternion, quaternion);
    this.threeObject.quaternion.copy(quaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  setLocalEulerAngles(eulerAngles: THREE.Euler) {
    this.threeObject.quaternion.setFromEuler(eulerAngles);
    this.threeObject.updateMatrixWorld(false);
  }

  setGlobalEulerAngles(eulerAngles: THREE.Euler) {
    if (!this.threeObject.parent) {
      return;
    }

    const globalQuaternion = new THREE.Quaternion().setFromEuler(eulerAngles);
    const inverseParentQuaternion = new THREE.Quaternion()
      .setFromRotationMatrix(Transform.Matrix.extractRotation(this.threeObject.parent.matrixWorld))
      .invert();
    globalQuaternion.multiplyQuaternions(inverseParentQuaternion, globalQuaternion);
    this.threeObject.quaternion.copy(globalQuaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  setLocalScale(scale: THREE.Vector3) {
    this.threeObject.scale.copy(scale);
    this.threeObject.updateMatrixWorld(false);
  }

  rotateGlobal(quaternion: THREE.Quaternion) {
    this.getGlobalOrientation(Transform.Quaternion);
    Transform.Quaternion.multiplyQuaternions(quaternion, Transform.Quaternion);
    this.setGlobalOrientation(Transform.Quaternion);
  }

  rotateLocal(quaternion: THREE.Quaternion) {
    this.threeObject.quaternion.multiplyQuaternions(quaternion, this.threeObject.quaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  rotateGlobalEulerAngles(eulerAngles: THREE.Euler) {
    const quaternion = new THREE.Quaternion().setFromEuler(eulerAngles);
    this.rotateGlobal(quaternion);
  }

  rotateLocalEulerAngles(eulerAngles: THREE.Euler) {
    const quaternion = new THREE.Quaternion().setFromEuler(eulerAngles);
    this.threeObject.quaternion.multiplyQuaternions(quaternion, this.threeObject.quaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  moveGlobal(offset: THREE.Vector3) {
    this.getGlobalPosition(Transform.Vector3).add(offset);
    this.setGlobalPosition(Transform.Vector3);
  }

  moveLocal(offset: THREE.Vector3) {
    this.threeObject.position.add(offset);
    this.threeObject.updateMatrixWorld(false);
  }

  moveOriented(offset: THREE.Vector3) {
    offset.applyQuaternion(this.threeObject.quaternion);
    this.threeObject.position.add(offset);
    this.threeObject.updateMatrixWorld(false);
  }
}
