// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import { Actor } from "./Actor.ts";
import type {
  Component,
  FreeComponentEnum
} from "../components/types.ts";

export interface ActorComponentOptions {
  actor: Actor;
  typeName: FreeComponentEnum;
}

export type ActorComponentEvents = {
  metadataInitialized: [];
};

export class ActorComponent extends EventEmitter<ActorComponentEvents> implements Component {
  actor: Actor;
  typeName: FreeComponentEnum;

  pendingForDestruction = false;

  constructor(
    options: ActorComponentOptions
  ) {
    super();
    this.actor = options.actor;
    this.typeName = options.typeName;

    this.actor.components.push(this);
    this.actor.gameInstance.scene.componentsToBeStarted.push(this);
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    const startIndex = this.actor.gameInstance.scene.componentsToBeStarted.indexOf(this);
    if (startIndex !== -1) {
      this.actor.gameInstance.scene.componentsToBeStarted.splice(startIndex, 1);
    }

    const index = this.actor.components.indexOf(this);
    if (index !== -1) {
      this.actor.components.splice(index, 1);
    }
  }
}
