// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ActorTree } from "./ActorTree.ts";
import { Transform } from "./Transform.ts";
import { IntegerIncrement } from "../systems/generators/IntegerIncrement.ts";
import { PersistentIdIncrement } from "../systems/generators/PersistentIdIncrement.ts";
import type { World, WorldDefaultContext } from "../systems/World.ts";
import type { Behavior } from "../components/script/Behavior.ts";
import type {
  Component
} from "../components/types.ts";

function isPendingForDestruction(component: Component): boolean {
  return "pendingForDestruction" in component && (component as any).pendingForDestruction === true;
}

type ComponentConstructor = new (actor: Actor<any>, ...args: any[]) => Component;

type RequiresOptions<T extends ComponentConstructor> =
  T extends new (actor: Actor<any>, options: infer O, ...args: any[]) => any
    ? undefined extends O ? false : true
    : false;

export interface ActorOptions<
  TContext = WorldDefaultContext
> {
  name: string;
  parent?: Actor<TContext> | null;
  visible?: boolean;
  layer?: number | number[];
}

export class Actor<
  TContext = WorldDefaultContext
> extends ActorTree<TContext> {
  static Id = new IntegerIncrement();
  static PersistentId = new PersistentIdIncrement();

  world: World<any, TContext>;

  id = Actor.Id.incr();
  persistentId = Actor.PersistentId.next();
  name: string;
  parent: Actor<TContext> | null = null;

  components: Component[] = [];
  componentsRequiringUpdate: Component[] = [];
  behaviors: Record<string, Behavior<any, TContext>[]> = {};

  awoken = false;
  pendingForDestruction = false;

  object3D = new THREE.Group();
  transform: Transform;

  constructor(
    world: World<any, TContext>,
    options: ActorOptions<TContext>
  ) {
    super();
    const { name, parent = null, visible = true, layer } = options;

    if (
      parent !== null &&
      parent.pendingForDestruction
    ) {
      throw new Error("Cannot add actor to a parent that is pending for destruction.");
    }

    this.world = world;
    this.name = name;
    this.parent = parent;

    this.object3D.visible = visible;
    this.object3D.name = this.name;
    this.object3D.userData.isActor = true;

    if (layer) {
      const layers = Array.isArray(layer) ? layer : [layer];
      for (const layer of layers) {
        this.object3D.layers.enable(layer);
        this.world.sceneManager.getSource().layers.enable(layer);
      }
    }

    this.transform = new Transform(this.object3D);

    if (parent) {
      parent.add(this);
      parent.object3D.add(this.object3D);
      this.object3D.updateMatrixWorld(false);
    }
    else {
      this.world.sceneManager.tree.add(this);
    }

    this.world.sceneManager.registerActor(this);
  }

  #initializeComponent(
    component: Component
  ) {
    if (this.awoken) {
      component.awake?.();
    }
    if (
      ("update" in component && typeof component.update === "function") ||
      ("fixedUpdate" in component && typeof component.fixedUpdate === "function")
    ) {
      component.needUpdate = true;
    }
  }

  addComponent<T extends ComponentConstructor>(
    componentClass: T,
    ...args: RequiresOptions<T> extends true
      ? [options: ConstructorParameters<T>[1], callback?: (component: InstanceType<T>) => void]
      : [options?: ConstructorParameters<T>[1], callback?: (component: InstanceType<T>) => void]
  ): this {
    const [options, callback] = args;

    const component = new componentClass(this, options);
    callback?.(component as InstanceType<T>);
    this.#initializeComponent(component);

    return this;
  }

  addComponentAndGet<T extends ComponentConstructor>(
    componentClass: T,
    ...args: RequiresOptions<T> extends true
      ? [options: ConstructorParameters<T>[1]]
      : [options?: ConstructorParameters<T>[1]]
  ): InstanceType<T> {
    const [options] = args;

    const component = new componentClass(this, options);
    this.#initializeComponent(component);

    return component as InstanceType<T>;
  }

  getComponent(typeName: string): Component | null;
  getComponent<T>(componentClass: new (...args: any[]) => T): T | null;
  getComponent(typeNameOrClass: string | (new (...args: any[]) => any)): Component | null {
    if (typeof typeNameOrClass === "string") {
      for (const comp of this.components) {
        if (comp.typeName === typeNameOrClass && !isPendingForDestruction(comp)) {
          return comp;
        }
      }

      return null;
    }

    for (const comp of this.components) {
      if (comp instanceof typeNameOrClass && !isPendingForDestruction(comp)) {
        return comp;
      }
    }

    return null;
  }

  * getComponents<T extends Component>(
    componentClass: new (...args: any[]) => T
  ): IterableIterator<T> {
    for (const comp of this.components) {
      if (comp instanceof componentClass && !isPendingForDestruction(comp)) {
        yield comp as T;
      }
    }
  }

  addChildren(
    ...objects: THREE.Object3D[]
  ): this {
    this.object3D.add(...objects);

    return this;
  }

  removeChildren(
    ...objects: THREE.Object3D[]
  ): this {
    for (const object of objects) {
      this.object3D.remove(object);
      Actor.disposeObject3D(object);
    }

    return this;
  }

  awake() {
    this.components.forEach((component) => component.awake?.());
  }

  update(
    deltaTime: number
  ) {
    if (!this.pendingForDestruction) {
      this.componentsRequiringUpdate.forEach((component) => component.update?.(deltaTime));
    }
  }

  fixedUpdate(
    deltaTime: number
  ) {
    if (!this.pendingForDestruction) {
      this.componentsRequiringUpdate.forEach((component) => component.fixedUpdate?.(deltaTime));
    }
  }

  override toString(): string {
    return `${this.name}:${this.id}-${this.persistentId}`;
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    this.world.sceneManager.unregisterActor(this);

    for (let i = this.components.length - 1; i >= 0; i--) {
      this.components[i].destroy?.();
    }

    if (this.parent === null) {
      this.world.sceneManager.tree.remove(this);
    }
    else {
      this.parent.object3D.remove(this.object3D);
      this.parent.remove(this);
    }

    this.object3D.traverse((child) => Actor.disposeObject3D(child));
    this.object3D.clear();
  }

  static disposeObject3D(
    object: THREE.Object3D
  ): void {
    if ("geometry" in object && object.geometry instanceof THREE.BufferGeometry) {
      object.geometry.dispose();
    }

    if ("material" in object) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        if (material instanceof THREE.Material) {
          material.dispose();
        }
      }
    }
  }

  markDestructionPending() {
    this.pendingForDestruction = true;
    this.destroyAllActors();
  }

  setParent(
    newParent: Actor<TContext>,
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

    const oldSiblings = (this.parent === null) ? this.world.sceneManager.tree : this.parent;
    oldSiblings.remove(this);
    this.object3D.parent?.remove(this.object3D);

    this.parent = newParent;

    const siblings = (newParent === null) ?
      this.world.sceneManager.tree :
      newParent;
    siblings.add(this);
    const threeParent = (newParent === null) ?
      this.world.sceneManager.getSource() :
      newParent.object3D;
    threeParent.add(this.object3D);

    if (keepLocal) {
      this.object3D.updateMatrixWorld(false);
    }
    else {
      this.transform.setGlobalMatrix(Transform.Matrix);
    }
  }
}
