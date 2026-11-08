// Import Internal Dependencies
import { ActorTree } from "./ActorTree.ts";
import { Transform } from "./transform/Transform.ts";
import { ActorComponents } from "./ActorComponents.ts";
import type { World, WorldDefaultContext } from "../systems/World.ts";
import type { BackendActorNode } from "../systems/SceneBackend.ts";
import type {
  Component,
  ComponentClass
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
  readonly node: BackendActorNode;
  readonly transform: Transform;

  #name: string;
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

    const { actors, graph } = world.sceneManager;
    this.world = world;
    this.id = actors.nextActorId();
    this.#name = name;
    this.parent = parent;
    this.persistentId = persistentId ?? actors.newPersistentId();
    this.persistent = persistent;

    this.node = graph.createNode(this);
    this.node.rename(name);
    if (layer !== undefined) {
      for (const enabled of Array.isArray(layer) ? layer : [layer]) {
        this.node.enableLayer(enabled);
      }
    }

    this.transform = new Transform(this.node);
    this.transform.visible = visible;

    actors.attach(this);
  }

  get name(): string {
    return this.#name;
  }

  set name(
    name: string
  ) {
    this.#name = name;
    this.node.rename(name);
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

  findComponent<T extends Component>(
    typeNameOrClass: string | ComponentClass<T>
  ): T | null {
    return this.components.find(typeNameOrClass);
  }

  findComponents<T extends Component>(
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
    this.node.dispose();
  }

  markDestructionPending() {
    if (this.#status !== "alive") {
      return;
    }
    this.#status = "pending";

    this.world.sceneManager.actors.destroyActorLater(this);
    this.destroyAllActors();
  }

  reparent(
    newParent: Actor<TContext> | null,
    keepLocal = false
  ) {
    if (this.pendingForDestruction) {
      throw new Error("Cannot reparent destroyed actor");
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
