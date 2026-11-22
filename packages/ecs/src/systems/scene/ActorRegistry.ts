// Import Internal Dependencies
import {
  type Actor,
  ActorTree
} from "../../actor/index.ts";
import type { WorldDefaultContext } from "../World.ts";
import type { HookedComponent } from "../../actor/ActorComponent.ts";
import { IntegerIncrement } from "../generators/IntegerIncrement.ts";
import { randomPersistentId } from "../generators/randomPersistentId.ts";
import type { SceneGraph } from "./SceneGraph.ts";

export class ActorRegistry<
  TContext = WorldDefaultContext
> {
  readonly tree = new ActorTree<TContext>();

  #graph: SceneGraph;
  #actorIds = new IntegerIncrement();
  #componentIds = new IntegerIncrement();
  #actors = new Map<string, Actor<TContext>>();
  #updatingActors: readonly Actor<TContext>[] = [];
  #frameActors: readonly Actor<TContext>[] = [];
  #actorsToAwake: Actor<TContext>[] = [];
  #componentsToStart = new Set<HookedComponent>();
  #componentsToDestroy: HookedComponent[] = [];
  #actorsToDestroy = new Set<Actor<TContext>>();
  #owner: object | null = null;
  #owners = new Map<Actor<TContext>, object>();

  constructor(
    graph: SceneGraph
  ) {
    this.#graph = graph;
  }

  has(
    actor: Actor<TContext>
  ): boolean {
    return this.#actors.get(actor.persistentId) === actor;
  }

  find(
    persistentId: string
  ): Actor<TContext> | null {
    return this.#actors.get(persistentId) ?? null;
  }

  get updating(): boolean {
    return this.#updatingActors.length > 0;
  }

  nextActorId(): number {
    return this.#actorIds.next();
  }

  nextComponentId(): number {
    return this.#componentIds.next();
  }

  newPersistentId(): string {
    let id: string;
    do {
      id = randomPersistentId();
    }
    while (this.#actors.has(id));

    return id;
  }

  attach(
    actor: Actor<TContext>
  ): void {
    if (this.#actors.has(actor.persistentId)) {
      throw new Error(
        `Actor persistent id "${actor.persistentId}" is already in use.`
      );
    }

    this.#actors.set(actor.persistentId, actor);
    this.#actorsToAwake.push(actor);
    if (this.#owner !== null) {
      this.#owners.set(actor, this.#owner);
    }
  }

  detach(
    actor: Actor<TContext>
  ): void {
    if (this.has(actor)) {
      this.#actors.delete(actor.persistentId);
      this.#stopUpdating(actor);
    }
    this.#owners.delete(actor);
  }

  requireUpdate(
    component: HookedComponent
  ): void {
    if (this.#componentsToStart.has(component)) {
      return;
    }

    const { actor } = component;
    const wasUpdating = actor.components.updating;
    actor.components.requireUpdate(component, component.needUpdate);

    if (
      actor.components.updating !== wasUpdating &&
      this.has(actor)
    ) {
      this.#reschedule(actor);
    }
  }

  reschedule(
    actor: Actor<TContext>
  ): void {
    this.#reschedule(actor);
    for (const { actor: descendant } of actor.walk()) {
      this.#reschedule(descendant);
    }
  }

  #reschedule(
    actor: Actor<TContext>
  ): void {
    if (
      this.has(actor) &&
      actor.components.updating &&
      actor.activeInHierarchy
    ) {
      this.#startUpdating(actor);
    }
    else {
      this.#stopUpdating(actor);
    }
  }

  destroyActorLater(
    actor: Actor<TContext>
  ): void {
    this.#actorsToDestroy.add(actor);
  }

  attachComponent(
    component: HookedComponent
  ): void {
    component.actor.components.attach(component);
    this.#componentsToStart.add(component);
  }

  detachComponent(
    component: HookedComponent
  ): void {
    this.#componentsToStart.delete(component);
    component.actor.components.detach(component);
  }

  destroyLater(
    component: HookedComponent
  ): void {
    this.#componentsToDestroy.push(component);
    this.#componentsToStart.delete(component);
  }

  ownedBy<T>(
    owner: object,
    run: () => T
  ): T {
    const previous = this.#owner;
    this.#owner = owner;
    try {
      return run();
    }
    finally {
      this.#owner = previous;
    }
  }

  destroyOwned(
    owner: object
  ): void {
    const owned = new Set<Actor<TContext>>();
    for (const [actor, actorOwner] of this.#owners) {
      if (actorOwner === owner) {
        owned.add(actor);
      }
    }

    this.destroyRoots(new Set(
      [...owned].filter(
        ({ root }) => !root.persistent || !owned.has(root)
      )
    ));
  }

  destroyRoots(
    actors: ReadonlySet<Actor<TContext>>
  ): void {
    for (const actor of actors) {
      if (
        this.has(actor) &&
        (actor.parent === null || !actors.has(actor.parent))
      ) {
        actor.destroy();
      }
    }
  }

  awake(): void {
    while (this.#actorsToAwake.length > 0) {
      const actors = this.#actorsToAwake;
      this.#actorsToAwake = [];
      for (const actor of actors) {
        if (this.has(actor) && !actor.awoken) {
          actor.awake();
        }
      }
    }
  }

  beginFrame(): void {
    this.awake();
    this.#startComponents();
    this.#frameActors = this.#updatingActors;
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex: number
  ): void {
    for (const actor of this.#frameActors) {
      actor.fixedUpdate(deltaTime, stepIndex);
    }
  }

  update(
    deltaTime: number,
    alpha: number
  ): void {
    for (const actor of this.#frameActors) {
      actor.update(deltaTime, alpha);
    }
  }

  endFrame(): void {
    const components = this.#componentsToDestroy;
    if (components.length > 0) {
      this.#componentsToDestroy = [];
      for (const component of components) {
        component.destroy();
      }
    }

    const actors = this.#actorsToDestroy;
    if (actors.size > 0) {
      this.#actorsToDestroy = new Set();
      this.destroyRoots(actors);
    }
  }

  clear(): void {
    for (const actor of [...this.tree.children]) {
      if (!actor.persistent || actor.pendingForDestruction) {
        actor.destroy();
      }
    }

    this.#graph.prune(
      this.tree.children.map((actor) => actor.node)
    );

    for (const component of this.#componentsToStart) {
      if (!this.has(component.actor)) {
        this.#componentsToStart.delete(component);
      }
    }
    this.#componentsToDestroy = this.#componentsToDestroy.filter(
      (component) => this.has(component.actor)
    );
    for (const actor of this.#actorsToDestroy) {
      if (!this.has(actor)) {
        this.#actorsToDestroy.delete(actor);
      }
    }
    this.#owners.clear();
    this.#frameActors = this.#updatingActors;
  }

  #startUpdating(
    actor: Actor<TContext>
  ): void {
    const actors = this.#updatingActors;
    let low = 0;
    let high = actors.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (actors[middle].id < actor.id) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }

    if (actors[low] !== actor) {
      this.#updatingActors = actors.toSpliced(low, 0, actor);
    }
  }

  #stopUpdating(
    actor: Actor<TContext>
  ): void {
    const index = this.#updatingActors.indexOf(actor);
    if (index !== -1) {
      this.#updatingActors = this.#updatingActors.toSpliced(index, 1);
    }
  }

  #startComponents(): void {
    for (const component of this.#componentsToStart) {
      if (this.has(component.actor) && component.actor.awoken) {
        this.#componentsToStart.delete(component);
        this.requireUpdate(component);
        component.start?.();
      }
    }
  }
}
