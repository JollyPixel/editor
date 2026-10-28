// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorTree } from "./ActorTree.ts";
import { Transform } from "./Transform.ts";
import {
  ActorComponents,
  type ComponentClass
} from "./ActorComponents.ts";
import { disposeObject3D } from "../utils/disposeObject3D.ts";
import type { World, WorldDefaultContext } from "../systems/World.ts";
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

export type ActorStatus = "alive" | "pending" | "destroyed";

export interface ActorOptions<
  TContext = WorldDefaultContext
> {
  name: string;
  parent?: Actor<TContext> | null;
  visible?: boolean;
  layer?: number | number[];
  persistentId?: string;
  persistent?: boolean;
}

export class Actor<
  TContext = WorldDefaultContext
> extends ActorTree<TContext> {
  world: World<any, TContext>;

  readonly id: number;
  readonly persistentId: string;
  persistent: boolean;
  parent: Actor<TContext> | null = null;

  readonly components = new ActorComponents();

  object3D = new THREE.Group();
  transform: Transform;

  #active = true;
  #awoken = false;
  #status: ActorStatus = "alive";

  constructor(
    world: World<any, TContext>,
    options: ActorOptions<TContext>
  ) {
    super();
    const {
      name,
      parent = null,
      visible = true,
      layer,
      persistentId,
      persistent = false
    } = options;

    if (
      parent !== null &&
      parent.pendingForDestruction
    ) {
      throw new Error("Cannot add actor to a parent that is pending for destruction.");
    }

    const { actors } = world.sceneManager;
    this.world = world;
    this.id = actors.nextActorId();
    this.name = name;
    this.parent = parent;
    this.persistentId = persistentId ?? actors.newPersistentId();
    this.persistent = persistent;

    this.object3D.visible = visible;
    this.object3D.userData.isActor = true;

    if (layer) {
      const layers = Array.isArray(layer) ? layer : [layer];
      for (const layer of layers) {
        this.object3D.layers.enable(layer);
        this.world.sceneManager.getSource().layers.enable(layer);
      }
    }

    this.transform = new Transform(this.object3D);

    actors.attach(this);
  }

  get name(): string {
    return this.object3D.name;
  }

  set name(
    name: string
  ) {
    this.object3D.name = name;
  }

  get status(): ActorStatus {
    return this.#status;
  }

  get pendingForDestruction(): boolean {
    return this.#status !== "alive";
  }

  get awoken(): boolean {
    return this.#awoken;
  }

  get active(): boolean {
    return this.#active;
  }

  set active(
    active: boolean
  ) {
    if (this.#active !== active) {
      this.#active = active;
      this.world.sceneManager.actors.reschedule(this);
    }
  }

  get activeInHierarchy(): boolean {
    return this.#active && (this.parent?.activeInHierarchy ?? true);
  }

  get root(): Actor<TContext> {
    return this.parent?.root ?? this;
  }

  hasDescendant(
    actor: Actor<TContext>
  ): boolean {
    let ancestor = actor.parent;
    while (ancestor !== null) {
      if (ancestor === this) {
        return true;
      }
      ancestor = ancestor.parent;
    }

    return false;
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
    if (this.#awoken) {
      component.bind?.();
      component.awake?.();
    }

    return component as InstanceType<T>;
  }

  getComponent<T extends Component>(
    typeNameOrClass: string | ComponentClass<T>
  ): T | null {
    return this.components.find(typeNameOrClass);
  }

  getComponents<T extends Component>(
    componentClass: ComponentClass<T>
  ): IterableIterator<T> {
    return this.components.matching(componentClass);
  }

  hasComponent(
    typeNameOrClass: string | ComponentClass
  ): boolean {
    return this.components.find(typeNameOrClass) !== null;
  }

  ensureComponent<T extends ComponentConstructor>(
    componentClass: T,
    ...args: ComponentOptionsArgs<T>
  ): InstanceType<T> {
    for (const component of this.components) {
      if (isInstance(component, componentClass)) {
        return component;
      }
    }

    return this.addComponentAndGet(componentClass, ...args);
  }

  removeComponent(
    componentOrClass: Component | ComponentClass
  ): boolean {
    const component = typeof componentOrClass === "function" ?
      this.components.find(componentOrClass) :
      componentOrClass;
    if (
      component === null ||
      component.actor !== this ||
      component.pendingForDestruction
    ) {
      return false;
    }

    component.markDestructionPending();

    return true;
  }

  findComponentInChildren<T extends Component>(
    componentClass: ComponentClass<T>
  ): T | null {
    for (const { actor } of this.walk()) {
      const component = actor.pendingForDestruction ?
        null :
        actor.components.find(componentClass);
      if (component !== null) {
        return component;
      }
    }

    return null;
  }

  findComponentInParent<T extends Component>(
    componentClass: ComponentClass<T>
  ): T | null {
    let ancestor = this.parent;
    while (ancestor !== null) {
      const component = ancestor.pendingForDestruction ?
        null :
        ancestor.components.find(componentClass);
      if (component !== null) {
        return component;
      }
      ancestor = ancestor.parent;
    }

    return null;
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
    this.components.awake();
    this.#awoken = true;
  }

  update(
    deltaTime: number,
    alpha = 0
  ) {
    if (!this.pendingForDestruction) {
      this.components.update(deltaTime, alpha);
    }
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex = 0
  ) {
    if (!this.pendingForDestruction) {
      this.components.fixedUpdate(deltaTime, stepIndex);
    }
  }

  override toString(): string {
    return `${this.name}:${this.id}-${this.persistentId}`;
  }

  destroy() {
    if (this.#status === "destroyed") {
      return;
    }
    this.#status = "destroyed";

    for (const child of [...this.children]) {
      child.destroy();
    }
    this.components.destroy();

    this.world.sceneManager.actors.detach(this);

    disposeObject3D(
      this.object3D,
      { stopAtActors: true }
    );
  }

  markDestructionPending() {
    if (this.#status !== "alive") {
      return;
    }
    this.#status = "pending";

    this.world.sceneManager.actors.destroyActorLater(this);
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

    this.world.sceneManager.actors.reparent(this, newParent, keepLocal);
  }
}

function isInstance<T extends ComponentConstructor>(
  component: Component,
  componentClass: T
): component is InstanceType<T> {
  return component instanceof componentClass;
}
