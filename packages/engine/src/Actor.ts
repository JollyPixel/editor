// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type GameInstance } from "./systems/GameInstance.js";
import { type Component } from "./ActorComponent.js";
import { Behavior } from "./Behavior.js";

// CONSTANTS
const kTmpMatrix = new THREE.Matrix4();
const kTmpVector3 = new THREE.Vector3();
const kTmpQuaternion = new THREE.Quaternion();

export interface ActorOptions {
  name: string;
  parent?: Actor | null;
  visible?: boolean;
  layer?: number;
}

export class Actor {
  name: string;
  awoken = false;
  parent: Actor | null = null;
  children: Actor[] = [];
  components: Component[] = [];
  behaviors: Record<string, Behavior[]> = {};
  layer = 0;
  pendingForDestruction = false;

  gameInstance: GameInstance;
  threeObject = new THREE.Object3D();

  constructor(
    gameInstance: GameInstance,
    options: ActorOptions
  ) {
    const { name, parent = null, visible = true, layer = 0 } = options;

    if (parent !== null && parent.pendingForDestruction) {
      throw new Error("Cannot add actor to a parent that is pending for destruction.");
    }

    this.gameInstance = gameInstance;
    this.name = name;
    this.parent = parent;
    this.layer = layer;

    this.threeObject.visible = visible;
    this.threeObject.name = this.name;
    this.threeObject.userData.isActor = true;

    if (parent) {
      parent.addChildren(this);
      this.threeObject.updateMatrixWorld(false);
    }
    else {
      this.gameInstance.addActor(this);
    }
  }

  addChildren(
    actor: Actor
  ) {
    if (actor.parent !== null) {
      return;
    }

    this.children.push(actor);
    this.threeObject.add(actor.threeObject);
  }

  removeChildren(
    actor: Actor
  ) {
    this.threeObject.remove(actor.threeObject);
    this.children.splice(this.children.indexOf(actor), 1);
  }

  registerComponent<
    T extends new (actor: Actor, options?: O) => Component,
    O = unknown
  >(
    componentClass: T,
    options?: O,
    callback?: (component: InstanceType<T>) => void
  ) {
    const component = new componentClass(this, options);
    if (this.components.indexOf(component) === -1) {
      this.components.push(component);
    }

    const index = this.gameInstance.componentsToBeStarted.indexOf(component);
    if (index === -1) {
      this.gameInstance.componentsToBeStarted.push(component);
    }

    callback?.(component as InstanceType<T>);

    return this;
  }

  awake() {
    this.components.forEach((component) => component.awake?.());
  }

  update() {
    if (this.pendingForDestruction) {
      return;
    }

    this.components.forEach((component) => component.update?.());
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    this.components.forEach((component) => component.destroy?.());

    if (this.parent === null) {
      this.gameInstance.removeActor(this);
    }
    else {
      this.parent.removeChildren(this);
    }

    this.threeObject.clear();
  }

  setActiveLayer(
    layer: number | null
  ) {
    const active = layer === null || this.layer === layer;
    for (const component of this.components) {
      component.setIsLayerActive?.(active);
    }
  }

  markDestructionPending() {
    this.pendingForDestruction = true;
    this.children.forEach((child) => child.markDestructionPending());
  }

  getVisible() {
    return this.threeObject.visible;
  }
  setVisible(visible: boolean) {
    this.threeObject.visible = visible;

    return this;
  }

  getChild(name: string) {
    // eslint-disable-next-line consistent-this
    let foundActor: Actor | null = this;

    name.split("/").every((namePart) => {
      let currentFoundActor: Actor | null = null;
      for (const { actor } of this.gameInstance.tree.walkFromNode(foundActor!)) {
        if (actor.name === namePart && !actor.isDestroyed() && currentFoundActor === null) {
          currentFoundActor = actor;
        }
      }

      if (currentFoundActor === null) {
        foundActor = null;

        return false;
      }
      foundActor = currentFoundActor;

      return true;
    });

    return foundActor === this ? null : foundActor;
  }

  getChildren(): Actor[] {
    return this.children.filter((child) => !child.isDestroyed());
  }

  // Behaviors
  getBehavior<T extends new(...args: any) => any>(
    behaviorClass: T
  ): InstanceType<T> | null {
    const behaviorList = this.behaviors[behaviorClass.name] ?? [];
    for (const behavior of behaviorList) {
      if (!behavior.isDestroyed()) {
        return behavior as InstanceType<T>;
      }
    }

    // Check for behaviors inheriting from the specified class
    for (const behaviorName in this.behaviors) {
      if (Object.hasOwn(this.behaviors, behaviorName)) {
        const behaviorList = this.behaviors[behaviorName];
        for (const behavior of behaviorList) {
          if (
            behavior instanceof behaviorClass &&
            !behavior.isDestroyed()
          ) {
            return behavior as InstanceType<T>;
          }
        }
      }
    }

    return null;
  }

  // Transform
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
    return angles.setFromQuaternion(this.getGlobalOrientation(kTmpQuaternion));
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
    m.lookAt(this.getGlobalPosition(kTmpVector3), target, up);
    this.setGlobalOrientation(kTmpQuaternion.setFromRotationMatrix(m));
  }

  lookTowards(direction: THREE.Vector3, up?: THREE.Vector3) {
    this.lookAt(this.getGlobalPosition(kTmpVector3).sub(direction), up);
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
      .setFromRotationMatrix(kTmpMatrix.extractRotation(this.threeObject.parent.matrixWorld))
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
      .setFromRotationMatrix(kTmpMatrix.extractRotation(this.threeObject.parent.matrixWorld))
      .invert();
    globalQuaternion.multiplyQuaternions(inverseParentQuaternion, globalQuaternion);
    this.threeObject.quaternion.copy(globalQuaternion);
    this.threeObject.updateMatrixWorld(false);
  }

  setLocalScale(scale: THREE.Vector3) {
    this.threeObject.scale.copy(scale);
    this.threeObject.updateMatrixWorld(false);
  }

  setParent(newParent: Actor, keepLocal = false) {
    if (this.pendingForDestruction) {
      throw new Error("Cannot set parent of destroyed actor");
    }
    if (newParent !== null && newParent.pendingForDestruction) {
      throw new Error("Cannot reparent actor to destroyed actor");
    }

    if (!keepLocal) {
      this.getGlobalMatrix(kTmpMatrix);
    }

    const oldSiblings = (this.parent === null) ? this.gameInstance.tree.root : this.parent.children;
    oldSiblings.splice(oldSiblings.indexOf(this), 1);
    this.threeObject.parent?.remove(this.threeObject);

    this.parent = newParent;

    const siblings = (newParent === null) ?
      this.gameInstance.tree.root :
      newParent.children;
    siblings.push(this);
    const threeParent = (newParent === null) ?
      this.gameInstance.threeScene :
      newParent.threeObject;
    threeParent.add(this.threeObject);

    if (keepLocal) {
      this.threeObject.updateMatrixWorld(false);
    }
    else {
      this.setGlobalMatrix(kTmpMatrix);
    }
  }

  rotateGlobal(quaternion: THREE.Quaternion) {
    this.getGlobalOrientation(kTmpQuaternion);
    kTmpQuaternion.multiplyQuaternions(quaternion, kTmpQuaternion);
    this.setGlobalOrientation(kTmpQuaternion);
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
    this.getGlobalPosition(kTmpVector3).add(offset);
    this.setGlobalPosition(kTmpVector3);
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
