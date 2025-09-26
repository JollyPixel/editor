// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import { Actor } from "../Actor.js";
import { ActorComponent, type Component } from "../ActorComponent.js";
import { ActorTree } from "../ActorTree.js";

export type SceneEvents = {
  awake: [];
};

export interface Scene {
  readonly tree: ActorTree;

  componentsToBeStarted: Component[];
  componentsToBeDestroyed: Component[];

  getSource(): THREE.Scene;
  awake(): void;
  update(deltaTime: number): void;
  destroyActor(actor: Actor): void;
}

export class SceneEngine extends EventEmitter<
  SceneEvents
> implements Scene {
  default = new THREE.Scene();

  componentsToBeStarted: Component[] = [];
  componentsToBeDestroyed: Component[] = [];

  #cachedActors: Actor[] = [];

  readonly tree = new ActorTree({
    addCallback: (actor) => this.default.add(actor.threeObject),
    removeCallback: (actor) => this.default.remove(actor.threeObject)
  });

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
    for (let i = 0; i < this.componentsToBeStarted.length; i++) {
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
    const actorToBeDestroyed: Actor[] = [];
    cachedActors.forEach((actor) => {
      actor.update(deltaTime);

      if (actor.isDestroyed()) {
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
    actor: Actor
  ) {
    while (actor.children.length > 0) {
      this.destroyActor(actor.children[0]);
    }

    const cachedIndex = this.#cachedActors.indexOf(actor);
    if (cachedIndex !== -1) {
      this.#cachedActors.splice(cachedIndex, 1);
    }

    actor.destroy();
  }

  destroyComponent(
    component: ActorComponent
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
