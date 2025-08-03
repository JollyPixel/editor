// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type GameInstance } from "./systems/GameInstance.js";
import { type Component } from "./ActorComponent.js";
import { Behavior } from "./Behavior.js";
import { Transform } from "./Transform.js";

type ComponentConstructor = new (actor: Actor, ...args: any[]) => Component;

type RequiresOptions<T extends ComponentConstructor> =
  T extends new (actor: Actor, options: infer O, ...args: any[]) => any
    ? undefined extends O ? false : true
    : false;

export interface ActorOptions {
  name: string;
  parent?: Actor | null;
  visible?: boolean;
  layer?: number;
}

export class Actor {
  gameInstance: GameInstance;

  name: string;
  awoken = false;
  parent: Actor | null = null;
  children: Actor[] = [];
  components: Component[] = [];
  behaviors: Record<string, Behavior<any>[]> = {};
  transform: Transform;
  layer = 0;
  pendingForDestruction = false;

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
    this.transform = new Transform(this.threeObject);

    if (parent) {
      parent.children.push(this);
      parent.threeObject.add(this.threeObject);
      this.threeObject.updateMatrixWorld(false);
    }
    else {
      this.gameInstance.tree.add(this);
    }
  }

  registerComponent<T extends ComponentConstructor>(
    componentClass: T,
    ...args: RequiresOptions<T> extends true
      ? [options: ConstructorParameters<T>[1], callback?: (component: InstanceType<T>) => void]
      : [options?: ConstructorParameters<T>[1], callback?: (component: InstanceType<T>) => void]
  ): this {
    const [options, callback] = args;
    const component = new componentClass(this, options);
    if (this.components.indexOf(component) === -1) {
      this.components.push(component);
    }

    const index = this.gameInstance.componentsToBeStarted.indexOf(component);
    if (index === -1) {
      this.gameInstance.componentsToBeStarted.push(component);
    }

    callback?.(component as InstanceType<T>);
    if (this.awoken) {
      component.awake?.();
    }

    return this;
  }

  awake() {
    this.components.forEach((component) => component.awake?.());
  }

  update() {
    if (!this.pendingForDestruction) {
      this.components.forEach((component) => component.update?.());
    }
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    this.components.forEach((component) => component.destroy?.());

    if (this.parent === null) {
      this.gameInstance.tree.remove(this);
    }
    else {
      this.parent.threeObject.remove(this.threeObject);
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
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

  getChild(name: string) {
    const nameParts = name.split("/");

    const findChildByPath = (currentActor: Actor, pathParts: string[]): Actor | null => {
      if (pathParts.length === 0) {
        return currentActor;
      }

      const [nextName, ...remainingParts] = pathParts;
      const foundChild = Array.from(this.gameInstance.tree.walkFromNode(currentActor))
        .find(({ actor }) => actor.name === nextName && !actor.isDestroyed());

      return foundChild ?
        findChildByPath(foundChild.actor, remainingParts) :
        null;
    };

    const result = findChildByPath(this, nameParts);

    return result === this ? null : result;
  }

  getChildren(): Actor[] {
    return this.children.filter((child) => !child.isDestroyed());
  }

  // Behaviors
  addBehavior<T extends new(...args: any) => Behavior>(
    behaviorClass: T,
    properties: ConstructorParameters<T>[0] = Object.create(null)
  ) {
    const behavior = new behaviorClass(this);

    for (const [propertyName, value] of Object.entries(properties)) {
      behavior.setProperty(propertyName, value as any);
    }

    if (this.awoken) {
      // @ts-ignore
      behavior.awake?.();
    }

    return behavior;
  }

  getBehavior<T extends new(...args: any) => any>(
    behaviorClass: T
  ): InstanceType<T> | null {
    for (const behaviorName in this.behaviors) {
      if (!Object.hasOwn(this.behaviors, behaviorName)) {
        continue;
      }

      for (const behavior of this.behaviors[behaviorName]) {
        if (
          behavior instanceof behaviorClass &&
          !behavior.isDestroyed()
        ) {
          return behavior as InstanceType<T>;
        }
      }
    }

    return null;
  }

  * getBehaviors<T extends new(...args: any) => any>(
    behaviorClass: T
  ): IterableIterator<InstanceType<T>> {
    for (const behaviorName in this.behaviors) {
      if (!Object.hasOwn(this.behaviors, behaviorName)) {
        continue;
      }

      for (const behavior of this.behaviors[behaviorName]) {
        if (
          behavior instanceof behaviorClass &&
          !behavior.isDestroyed()
        ) {
          yield behavior as InstanceType<T>;
        }
      }
    }
  }

  setParent(
    newParent: Actor,
    keepLocal = false
  ) {
    if (this.pendingForDestruction) {
      throw new Error("Cannot set parent of destroyed actor");
    }
    if (newParent !== null && newParent.pendingForDestruction) {
      throw new Error("Cannot reparent actor to destroyed actor");
    }

    if (!keepLocal) {
      this.transform.getGlobalMatrix(Transform.Matrix);
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
      this.transform.setGlobalMatrix(Transform.Matrix);
    }
  }
}
