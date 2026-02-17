// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import { Actor } from "./Actor.ts";
import { getSignalMetadata, SignalEvent } from "./Signal.ts";
import { IntegerIncrement } from "../systems/generators/IntegerIncrement.ts";
import { PersistentIdIncrement } from "../systems/generators/PersistentIdIncrement.ts";
import type {
  WorldDefaultContext
} from "../systems/World.ts";
import type {
  Component,
  FreeComponentEnum
} from "../components/types.ts";

export interface ActorComponentOptions<
  TContext = WorldDefaultContext
> {
  actor: Actor<TContext>;
  typeName: FreeComponentEnum;
}

export type ActorComponentEvents = {
  metadataInitialized: [];
};

export class ActorComponent<
  TContext = WorldDefaultContext
> extends EventEmitter<ActorComponentEvents> implements Component {
  static Id = new IntegerIncrement();
  static PersistentId = new PersistentIdIncrement();

  id = ActorComponent.Id.incr();
  persistentId = ActorComponent.PersistentId.next();
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
    this.actor.world.sceneManager.componentsToBeStarted.push(this);

    // Defer the initialization of signal decorators to ensure
    // that the component instance is fully constructed
    queueMicrotask(() => this.#initSignalDecorators());
  }

  get context(): TContext {
    return this.actor.world.context;
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

  override toString(): string {
    return `${this.typeName}:${this.id}-${this.persistentId}`;
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy() {
    const startIndex = this.actor.world.sceneManager.componentsToBeStarted.indexOf(this);
    if (startIndex !== -1) {
      this.actor.world.sceneManager.componentsToBeStarted.splice(startIndex, 1);
    }

    const index = this.actor.components.indexOf(this);
    if (index !== -1) {
      this.actor.components.splice(index, 1);
    }
  }
}
