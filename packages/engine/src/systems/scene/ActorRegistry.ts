// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  type Actor,
  ActorTree
} from "../../actor/index.ts";
import type { WorldDefaultContext } from "../World.ts";
import type { Component } from "../../components/types.ts";

export class ActorRegistry<
  TContext = WorldDefaultContext
> {
  readonly tree: ActorTree<TContext>;

  #root: THREE.Object3D;
  #actors = new Set<Actor<TContext>>();
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
    return this.#actors.has(actor);
  }

  get updating(): boolean {
    return this.#updatingActors.length > 0;
  }

  attach(
    actor: Actor<TContext>
  ): void {
    if (actor.parent === null) {
      this.tree.add(actor);
    }
    else {
      actor.parent.add(actor);
      actor.parent.object3D.add(actor.object3D);
      actor.object3D.updateMatrixWorld(false);
    }

    this.#actors.add(actor);
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
  }

  detach(
    actor: Actor<TContext>
  ): void {
    if (
      this.#actors.delete(actor) &&
      actor.componentsRequiringUpdate.length > 0
    ) {
      this.#stopUpdating(actor);
    }
    (actor.parent ?? this.tree).remove(actor);
  }

  requireUpdate(
    component: Component,
    required: boolean
  ): void {
    const { actor } = component;
    const before = actor.componentsRequiringUpdate;
    const index = before.indexOf(component);
    if (required === (index !== -1)) {
      return;
    }

    const after = required ?
      [...before, component] :
      before.toSpliced(index, 1);
    actor.componentsRequiringUpdate = after;

    if (!this.#actors.has(actor)) {
      return;
    }
    if (before.length === 0) {
      this.#startUpdating(actor);
    }
    else if (after.length === 0) {
      this.#stopUpdating(actor);
    }
  }

  destroyActorLater(
    actor: Actor<TContext>
  ): void {
    actor.pendingForDestruction = true;
    this.#actorsToDestroy.add(actor);
  }

  attachComponent(
    component: Component
  ): void {
    component.actor.components.push(component);
    this.#componentsToStart.push(component);
  }

  detachComponent(
    component: Component
  ): void {
    this.#cancelStart(component);

    const { components } = component.actor;
    const index = components.indexOf(component);
    if (index !== -1) {
      components.splice(index, 1);
    }
  }

  destroyLater(
    component: Component
  ): void {
    if (component.pendingForDestruction) {
      return;
    }

    component.pendingForDestruction = true;
    this.#componentsToDestroy.push(component);
    this.#cancelStart(component);
  }

  collect(
    build: () => void
  ): ReadonlySet<Actor<TContext>> {
    const before = new Set(this.#actors);
    build();

    const collected = new Set<Actor<TContext>>();
    for (const actor of this.#actors) {
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
        this.#actors.has(actor) &&
        (actor.parent === null || !actors.has(actor.parent))
      ) {
        actor.destroy();
      }
    }
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
      actor.destroy();
    }

    this.#componentsToStart.length = 0;
    this.#componentsToDestroy.length = 0;
    this.#actorsToDestroy.clear();
    this.#updatingActors = [];
    this.#frameActors = [];
    this.#actors.clear();
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

    this.#updatingActors = actors.toSpliced(low, 0, actor);
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
      if (this.#actors.has(component.actor)) {
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
