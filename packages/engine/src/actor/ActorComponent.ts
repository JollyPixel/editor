// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import { Actor } from "./Actor.ts";
import { getSignalMetadata, SignalEvent } from "./Signal.ts";
import type {
  Component,
  FreeComponentEnum
} from "../components/types.ts";

export interface ActorComponentOptions<TContext = Record<string, unknown>> {
  actor: Actor<TContext>;
  typeName: FreeComponentEnum;
}

export type ActorComponentEvents = {
  metadataInitialized: [];
};

export class ActorComponent<TContext = Record<string, unknown>> extends EventEmitter<ActorComponentEvents> implements Component {
  protected static Id = 0;

  static generateNextId() {
    return this.Id++;
  }

  static clearId() {
    this.Id = 0;
  }

  id = ActorComponent.generateNextId();
  actor: Actor<TContext>;
  typeName: FreeComponentEnum;

  pendingForDestruction = false;

  constructor(
    options: ActorComponentOptions<TContext>
  ) {
    super();
    this.actor = options.actor;
    this.typeName = options.typeName;

    this.actor.components.push(this);
    this.actor.gameInstance.scene.componentsToBeStarted.push(this);

    // Defer the initialization of signal decorators to ensure
    // that the component instance is fully constructed
    queueMicrotask(() => this.#initSignalDecorators());
  }

  #initSignalDecorators() {
    const proto = Object.getPrototypeOf(this);
    const metadata = getSignalMetadata(proto);

    if (metadata) {
      for (const propertyName of metadata.signals) {
        this[propertyName] = new SignalEvent();
      }
    }
    this.emit("metadataInitialized");
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
