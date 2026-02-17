// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent,
  ActorTree
} from "../actor/index.ts";
import type { Component } from "../components/types.ts";

export type SceneEvents = {
  awake: [];
};

export interface Scene {
  readonly tree: ActorTree<any>;

  componentsToBeStarted: Component[];
  componentsToBeDestroyed: Component[];

  getSource(): THREE.Scene;
  awake(): void;
  update(deltaTime: number): void;
  destroyActor(actor: Actor<any>): void;
}

export class SceneEngine extends EventEmitter<
  SceneEvents
> implements Scene {
  default: THREE.Scene;

  componentsToBeStarted: Component[] = [];
  componentsToBeDestroyed: Component[] = [];

  #cachedActors: Actor<any>[] = [];

  readonly tree = new ActorTree<any>({
    addCallback: (actor) => this.default.add(actor.threeObject),
    removeCallback: (actor) => this.default.remove(actor.threeObject)
  });

  constructor(scene?: THREE.Scene) {
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

  update(
    deltaTime: number
  ) {
    this.#cachedActors.length = 0;
    for (const { actor } of this.tree.walk()) {
      this.#cachedActors.push(actor);
    }

    const cachedActors = this.#cachedActors;

    let i = 0;
    while (i < this.componentsToBeStarted.length) {
      const component = this.componentsToBeStarted[i];

      // If the component to be started is part of an actor
      // which will not be updated, skip it until next loop
      if (cachedActors.indexOf(component.actor) === -1) {
        i++;
        continue;
      }

      component.start?.();
      this.componentsToBeStarted.splice(i, 1);
    }

    // Update all actors
    const actorToBeDestroyed: Actor<any>[] = [];
    cachedActors.forEach((actor) => {
      actor.update(deltaTime);

      if (actor.pendingForDestruction || actor.isDestroyed()) {
        actorToBeDestroyed.push(actor);
      }
    });

    // Apply pending component / actor destructions
    this.componentsToBeDestroyed.forEach((component) => {
      component.destroy();
    });
    this.componentsToBeDestroyed.length = 0;

    actorToBeDestroyed.forEach((actor) => {
      this.destroyActor(actor);
    });
  }

  destroyActor(
    actor: Actor<any>
  ) {
    const childrenToDestroy = [...actor.children];

    childrenToDestroy.forEach((child) => {
      this.destroyActor(child);
    });

    const cachedIndex = this.#cachedActors.indexOf(actor);
    if (cachedIndex !== -1) {
      this.#cachedActors.splice(cachedIndex, 1);
    }

    // NOTE: make sure to remove deeply into the tree
    this.tree.remove(actor);
    actor.destroy();
  }

  destroyComponent(
    component: ActorComponent<any>
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
