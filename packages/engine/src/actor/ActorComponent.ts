// Import Internal Dependencies
import { Actor } from "./Actor.js";
import type {
  Component,
  FreeComponentEnum
} from "../components/types.js";

export interface ActorComponentOptions {
  actor: Actor;
  typeName: FreeComponentEnum;
}

export class ActorComponent implements Component {
  actor: Actor;
  typeName: FreeComponentEnum;

  pendingForDestruction = false;

  constructor(
    options: ActorComponentOptions
  ) {
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
