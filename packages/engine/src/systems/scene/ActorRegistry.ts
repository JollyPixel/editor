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
  #frameActors: Actor<TContext>[] = [];
  #hasActorsToAwake = false;
  #componentsToStart: Component[] = [];
  #componentsToDestroy: Component[] = [];

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
    this.#actors.delete(actor);
    (actor.parent ?? this.tree).remove(actor);
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
    this.#frameActors = Array.from(this.#actors);
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
    for (const component of this.#componentsToDestroy.splice(0)) {
      component.destroy();
    }

    for (const actor of this.#frameActors) {
      if (
        actor.pendingForDestruction &&
        this.#actors.has(actor) &&
        !actor.parent?.pendingForDestruction
      ) {
        actor.destroy();
      }
    }
  }

  clear(): void {
    for (const actor of [...this.tree.children]) {
      actor.destroy();
    }

    this.#componentsToStart.length = 0;
    this.#componentsToDestroy.length = 0;
    this.#frameActors.length = 0;
    this.#actors.clear();
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
