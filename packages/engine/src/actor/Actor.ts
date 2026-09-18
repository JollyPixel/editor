// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorTree } from "./ActorTree.ts";
import { Transform } from "./Transform.ts";
import { IntegerIncrement } from "../systems/generators/IntegerIncrement.ts";
import { PersistentIdIncrement } from "../systems/generators/PersistentIdIncrement.ts";
import { disposeObject3D } from "../utils/disposeObject3D.ts";
import type { World, WorldDefaultContext } from "../systems/World.ts";
import type { Behavior } from "../components/script/Behavior.ts";
import type {
  Component
} from "../components/types.ts";

type ComponentConstructor = new (actor: Actor<any>, ...args: any[]) => Component;

type RequiresOptions<T extends ComponentConstructor> =
  T extends new (actor: Actor<any>, options: infer O, ...args: any[]) => any
    ? undefined extends O ? false : true
    : false;

type ComponentOptionsArgs<T extends ComponentConstructor> =
  RequiresOptions<T> extends true
    ? [options: ConstructorParameters<T>[1]]
    : [options?: ConstructorParameters<T>[1]];

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

  addComponent<T extends ComponentConstructor>(
    componentClass: T,
    ...args: ComponentOptionsArgs<T>
  ): this {
    this.addComponentAndGet(componentClass, ...args);

    return this;
  }

  addComponentAndGet<T extends ComponentConstructor>(
    componentClass: T,
    ...args: ComponentOptionsArgs<T>
  ): InstanceType<T> {
    const component = new componentClass(this, args[0]);
    if (this.awoken) {
      awakeComponent(component);
    }

    return component as InstanceType<T>;
  }

  getComponent<T extends Component>(typeName: string): T | null;
  getComponent<T extends Component>(componentClass: new (...args: any[]) => T): T | null;
  getComponent<T extends Component>(typeNameOrClass: string | (new (...args: any[]) => T)): T | null {
    const matches = typeof typeNameOrClass === "string" ?
      (component: Component) => component.typeName === typeNameOrClass :
      (component: Component) => component instanceof typeNameOrClass;

    const component = this.components.find(
      (component) => matches(component) && !component.pendingForDestruction
    );

    return (component as T | undefined) ?? null;
  }

  * getComponents<T extends Component>(
    componentClass: new (...args: any[]) => T
  ): IterableIterator<T> {
    for (const component of this.components) {
      if (component instanceof componentClass && !component.pendingForDestruction) {
        yield component;
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
      disposeObject3D(object);
    }

    return this;
  }

  awake() {
    for (let i = 0; i < this.components.length; i++) {
      awakeComponent(this.components[i]);
    }
    this.awoken = true;
  }

  update(
    deltaTime: number,
    alpha = 0
  ) {
    if (!this.pendingForDestruction) {
      for (const component of [...this.componentsRequiringUpdate]) {
        component.update?.(deltaTime, alpha);
      }
    }
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex = 0
  ) {
    if (!this.pendingForDestruction) {
      for (const component of [...this.componentsRequiringUpdate]) {
        component.fixedUpdate?.(deltaTime, stepIndex);
      }
    }
  }

  override toString(): string {
    return `${this.name}:${this.id}-${this.persistentId}`;
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    for (const child of [...this.children]) {
      child.destroy();
    }
    for (const component of [...this.components].reverse()) {
      component.destroy();
    }

    this.world.sceneManager.unregisterActor(this);
    (this.parent ?? this.world.sceneManager.tree).remove(this);

    disposeObject3D(
      this.object3D,
      { stopAtActors: true }
    );
  }

  markDestructionPending() {
    this.pendingForDestruction = true;
    this.destroyAllActors();
  }

  setParent(
    newParent: Actor<TContext> | null,
    keepLocal = false
  ) {
    if (this.pendingForDestruction) {
      throw new Error("Cannot set parent of destroyed actor");
    }
    if (newParent?.pendingForDestruction) {
      throw new Error("Cannot reparent actor to destroyed actor");
    }

    const threeParent = newParent?.object3D ?? this.world.sceneManager.getSource();
    if (keepLocal) {
      threeParent.add(this.object3D);
    }
    else {
      threeParent.attach(this.object3D);
    }

    (this.parent ?? this.world.sceneManager.tree).remove(this);
    this.parent = newParent;
    (newParent ?? this.world.sceneManager.tree).add(this);

    this.object3D.updateMatrixWorld(false);
  }
}

function awakeComponent(
  component: Component
): void {
  component.bind?.();
  component.awake?.();
}
