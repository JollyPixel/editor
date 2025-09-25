// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type GameInstance } from "./systems/GameInstance.js";
import { type Component } from "./ActorComponent.js";
import { ActorTree } from "./ActorTree.js";
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
  layer?: number | number[];
}

export class Actor extends ActorTree {
  gameInstance: GameInstance;

  name: string;
  awoken = false;
  parent: Actor | null = null;
  components: Component[] = [];
  behaviors: Record<string, Behavior<any>[]> = {};
  transform: Transform;
  pendingForDestruction = false;

  threeObject = new THREE.Group();

  constructor(
    gameInstance: GameInstance,
    options: ActorOptions
  ) {
    super();
    const { name, parent = null, visible = true, layer } = options;

    if (parent !== null && parent.pendingForDestruction) {
      throw new Error("Cannot add actor to a parent that is pending for destruction.");
    }

    this.gameInstance = gameInstance;
    this.name = name;
    this.parent = parent;

    this.threeObject.visible = visible;
    this.threeObject.name = this.name;
    this.threeObject.userData.isActor = true;

    if (layer) {
      const layers = Array.isArray(layer) ? layer : [layer];
      for (const layer of layers) {
        this.threeObject.layers.enable(layer);
        this.gameInstance.threeScene.layers.enable(layer);
      }
    }

    this.transform = new Transform(this.threeObject);

    if (parent) {
      parent.add(this);
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

  registerComponentAndGet<T extends ComponentConstructor>(
    componentClass: T,
    ...args: RequiresOptions<T> extends true
      ? [options: ConstructorParameters<T>[1]]
      : [options?: ConstructorParameters<T>[1]]
  ): InstanceType<T> {
    const [options] = args;
    const component = new componentClass(this, options);
    if (this.components.indexOf(component) === -1) {
      this.components.push(component);
    }

    const index = this.gameInstance.componentsToBeStarted.indexOf(component);
    if (index === -1) {
      this.gameInstance.componentsToBeStarted.push(component);
    }

    if (this.awoken) {
      component.awake?.();
    }

    return component as InstanceType<T>;
  }

  awake() {
    this.components.forEach((component) => component.awake?.());
  }

  update(
    deltaTime: number
  ) {
    if (!this.pendingForDestruction) {
      this.components.forEach((component) => component.update?.(deltaTime));
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
      this.parent.remove(this);
    }

    this.threeObject.clear();
  }

  markDestructionPending() {
    this.pendingForDestruction = true;
    this.destroyAllActors();
  }

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

    const oldSiblings = (this.parent === null) ? this.gameInstance.tree : this.parent;
    oldSiblings.remove(this);
    this.threeObject.parent?.remove(this.threeObject);

    this.parent = newParent;

    const siblings = (newParent === null) ?
      this.gameInstance.tree :
      newParent;
    siblings.add(this);
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
