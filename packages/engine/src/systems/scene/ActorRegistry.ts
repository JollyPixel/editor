// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  type Actor,
  ActorTree
} from "../../actor/index.ts";
import type { WorldDefaultContext } from "../World.ts";
import type { Component } from "../../components/types.ts";
import { IntegerIncrement } from "../generators/IntegerIncrement.ts";
import { randomPersistentId } from "../generators/randomPersistentId.ts";

export class ActorRegistry<
  TContext = WorldDefaultContext
> {
  readonly tree: ActorTree<TContext>;

  #root: THREE.Object3D;
  #actorIds = new IntegerIncrement();
  #componentIds = new IntegerIncrement();
  #actors = new Map<string, Actor<TContext>>();
  #updatingActors: readonly Actor<TContext>[] = [];
  #frameActors: readonly Actor<TContext>[] = [];
  #hasActorsToAwake = false;
  #componentsToStart: Component[] = [];
  #componentsToDestroy: Component[] = [];
  #actorsToDestroy = new Set<Actor<TContext>>();

  constructor(
    root: THREE.Object3D
  ) {
    this.#root = root;
    this.tree = new ActorTree<TContext>({
      addCallback: (actor) => root.add(actor.object3D),
      removeCallback: (actor) => root.remove(actor.object3D)
    });
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

    if (actor.parent === null) {
      this.tree.add(actor);
    }
    else {
      actor.parent.add(actor);
      actor.parent.object3D.add(actor.object3D);
      actor.object3D.updateMatrixWorld(false);
    }

    this.#actors.set(actor.persistentId, actor);
    this.#hasActorsToAwake = true;
  }

  reparent(
    actor: Actor<TContext>,
    parent: Actor<TContext> | null,
    keepLocal: boolean
  ): void {
    const threeParent = parent?.object3D ?? this.#root;
    if (keepLocal) {
      threeParent.add(actor.object3D);
    }
    else {
      threeParent.attach(actor.object3D);
    }

    (actor.parent ?? this.tree).remove(actor);
    actor.parent = parent;
    (parent ?? this.tree).add(actor);

    actor.object3D.updateMatrixWorld(false);
    this.reschedule(actor);
  }

  detach(
    actor: Actor<TContext>
  ): void {
    if (this.has(actor)) {
      this.#actors.delete(actor.persistentId);
      if (actor.components.updating) {
        this.#stopUpdating(actor);
      }
    }
    (actor.parent ?? this.tree).remove(actor);
  }

  requireUpdate(
    component: Component,
    required: boolean
  ): void {
    const { components } = component.actor;
    const wasUpdating = components.updating;
    components.requireUpdate(component, required);

    if (
      components.updating === wasUpdating ||
      !this.has(component.actor)
    ) {
      return;
    }
    if (!components.updating) {
      this.#stopUpdating(component.actor);
    }
    else if (component.actor.activeInHierarchy) {
      this.#startUpdating(component.actor);
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
    component: Component
  ): void {
    component.actor.components.attach(component);
    this.#componentsToStart.push(component);
  }

  detachComponent(
    component: Component
  ): void {
    this.#cancelStart(component);
    component.actor.components.detach(component);
  }

  destroyLater(
    component: Component
  ): void {
    this.#componentsToDestroy.push(component);
    this.#cancelStart(component);
  }

  collect(
    build: () => void
  ): ReadonlySet<Actor<TContext>> {
    const before = new Set(this.#actors.values());
    build();

    const collected = new Set<Actor<TContext>>();
    for (const actor of this.#actors.values()) {
      if (!before.has(actor)) {
        collected.add(actor);
      }
    }

    return collected;
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

  destroySceneActors(
    actors: ReadonlySet<Actor<TContext>>
  ): void {
    this.destroyRoots(new Set(
      [...actors].filter(
        ({ root }) => !root.persistent || !actors.has(root)
      )
    ));
  }

  awake(): void {
    this.#hasActorsToAwake = false;
    for (const { actor } of this.tree.walk()) {
      if (!actor.awoken) {
        actor.awake();
      }
    }
  }

  beginFrame(): void {
    if (this.#hasActorsToAwake) {
      this.awake();
    }
    this.#frameActors = this.#updatingActors;
    this.#startComponents();
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

    const survivors = new Set<THREE.Object3D>(
      this.tree.children.map((actor) => actor.object3D)
    );
    for (const object of [...this.#root.children]) {
      if (!survivors.has(object)) {
        this.#root.remove(object);
      }
    }

    this.#componentsToStart = this.#componentsToStart.filter(
      (component) => this.has(component.actor)
    );
    this.#componentsToDestroy = this.#componentsToDestroy.filter(
      (component) => this.has(component.actor)
    );
    for (const actor of this.#actorsToDestroy) {
      if (!this.has(actor)) {
        this.#actorsToDestroy.delete(actor);
      }
    }
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
    const components = this.#componentsToStart;
    let i = 0;
    while (i < components.length) {
      const component = components[i];
      if (this.has(component.actor)) {
        components.splice(i, 1);
        component.start?.();
      }
      else {
        i++;
      }
    }
  }

  #cancelStart(
    component: Component
  ): void {
    const index = this.#componentsToStart.indexOf(component);
    if (index !== -1) {
      this.#componentsToStart.splice(index, 1);
    }
  }
}
