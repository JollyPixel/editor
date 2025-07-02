// Import Internal Dependencies
import { Actor } from "./Actor.js";

export type ComponentType =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | (string & {});

export interface Component {
  actor: Actor;
  typeName: ComponentType;

  awake?(): void;
  start?(): void;
  update?(): void;
  destroy(): void;
  setIsLayerActive?(active: boolean): void;
}

export interface ActorComponentOptions {
  actor: Actor;
  typeName: ComponentType;
}

export class ActorComponent implements Component {
  actor: Actor;
  typeName: ComponentType;

  pendingForDestruction = false;

  constructor(
    options: ActorComponentOptions
  ) {
    this.actor = options.actor;
    this.typeName = options.typeName;

    this.actor.components.push(this);
    this.actor.gameInstance.componentsToBeStarted.push(this);
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    const startIndex = this.actor.gameInstance.componentsToBeStarted.indexOf(this);
    if (startIndex !== -1) {
      this.actor.gameInstance.componentsToBeStarted.splice(startIndex, 1);
    }

    const index = this.actor.components.indexOf(this);
    if (index !== -1) {
      this.actor.components.splice(index, 1);
    }
  }
}
