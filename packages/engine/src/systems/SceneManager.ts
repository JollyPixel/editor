// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent,
  ActorTree
} from "../actor/index.ts";
import type { WorldDefaultContext } from "./World.ts";
import type { Component } from "../components/types.ts";

export type SceneEvents = {
  awake: [];
};

export class SceneManager<
  TContext = WorldDefaultContext
> extends EventEmitter<SceneEvents> {
  default: THREE.Scene;

  componentsToBeStarted: Component[] = [];
  componentsToBeDestroyed: Component[] = [];

  #registeredActors: Set<Actor<TContext>> = new Set();
  #actorsByName: Map<string, Actor<TContext>[]> = new Map();
  #cachedActors: Actor<TContext>[] = [];

  readonly tree = new ActorTree<TContext>({
    addCallback: (actor) => this.default.add(actor.object3D),
    removeCallback: (actor) => this.default.remove(actor.object3D)
  });

  constructor(
    scene?: THREE.Scene
  ) {
    super();
    this.default = scene ?? new THREE.Scene();
  }

  getSource() {
    return this.default;
  }

  awake() {
    for (const { actor } of this.tree.walk()) {
      if (!actor.awoken) {
        actor.awake();
        actor.awoken = true;
      }
    }
    this.emit("awake");
  }

  beginFrame() {
    this.#cachedActors = Array.from(this.#registeredActors);

    let i = 0;
    while (i < this.componentsToBeStarted.length) {
      const component = this.componentsToBeStarted[i];

      // If the component to be started is part of an actor
      // which will not be updated, skip it until next loop
      if (!this.#registeredActors.has(component.actor)) {
        i++;
        continue;
      }

      component.start?.();
      this.componentsToBeStarted.splice(i, 1);
    }
  }

  fixedUpdate(
    deltaTime: number
  ) {
    this.#cachedActors.forEach((actor) => {
      actor.fixedUpdate(deltaTime);
    });
  }

  update(
    deltaTime: number
  ) {
    this.#cachedActors.forEach((actor) => {
      actor.update(deltaTime);
    });
  }

  endFrame() {
    this.componentsToBeDestroyed.forEach((component) => {
      component.destroy();
    });
    this.componentsToBeDestroyed.length = 0;

    const actorToBeDestroyed: Actor<TContext>[] = [];
    this.#cachedActors.forEach((actor) => {
      if (actor.pendingForDestruction || actor.isDestroyed()) {
        actorToBeDestroyed.push(actor);
      }
    });

    actorToBeDestroyed.forEach((actor) => {
      this.destroyActor(actor);
    });
  }

  destroyActor(
    actor: Actor<TContext>
  ) {
    const childrenToDestroy = [...actor.children];

    childrenToDestroy.forEach((child) => {
      this.destroyActor(child);
    });

    this.unregisterActor(actor);

    // NOTE: make sure to remove deeply into the tree
    this.tree.remove(actor);
    actor.destroy();
  }

  registerActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.add(actor);

    const actors = this.#actorsByName.get(actor.name);
    if (actors) {
      actors.push(actor);
    }
    else {
      this.#actorsByName.set(actor.name, [actor]);
    }
  }

  unregisterActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.delete(actor);

    const actors = this.#actorsByName.get(actor.name);
    if (actors) {
      const index = actors.indexOf(actor);
      if (index !== -1) {
        actors.splice(index, 1);
      }
      if (actors.length === 0) {
        this.#actorsByName.delete(actor.name);
      }
    }
  }

  getActor(
    name: string
  ): Actor<TContext> | null {
    const actors = this.#actorsByName.get(name);
    if (!actors) {
      return null;
    }

    for (const actor of actors) {
      if (!actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  }

  destroyComponent(
    component: ActorComponent<TContext>
  ) {
    if (component.pendingForDestruction) {
      return;
    }

    this.componentsToBeDestroyed.push(component);
    component.pendingForDestruction = true;

    const index = this.componentsToBeStarted.indexOf(component);
    if (index !== -1) {
      this.componentsToBeStarted.splice(index, 1);
    }
  }
}
