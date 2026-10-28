// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Actor } from "./Actor.ts";
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
  needUpdate?: boolean;
}

export class ActorComponent<
  TContext = WorldDefaultContext
> implements Component {
  static Id = new IntegerIncrement();
  static PersistentId = new PersistentIdIncrement();

  id = ActorComponent.Id.incr();
  persistentId = ActorComponent.PersistentId.next();
  actor: Actor<TContext>;
  typeName: FreeComponentEnum;

  #needUpdate = false;
  #destroyed = false;
  #teardowns: (() => void)[] = [];
  pendingForDestruction = false;

  constructor(
    options: ActorComponentOptions<TContext>
  ) {
    this.actor = options.actor;
    this.typeName = options.typeName;

    this.actor.world.sceneManager.actors.attachComponent(this);
    this.needUpdate = options.needUpdate ?? hasUpdateHook(this);
  }

  get needUpdate(): boolean {
    return this.#needUpdate;
  }

  set needUpdate(
    value: boolean
  ) {
    this.#needUpdate = value;
    this.actor.world.sceneManager.actors.requireUpdate(this, value);
  }

  get context(): TContext {
    return this.actor.world.context;
  }

  protected getAsset<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    return this.actor.world.assetCoordinator.get(reference);
  }

  addTeardown(
    teardown: () => void
  ): void {
    this.#teardowns.push(teardown);
  }

  toString(): string {
    return `${this.typeName}:${this.id}-${this.persistentId}`;
  }

  isDestroyed() {
    return this.pendingForDestruction;
  }

  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.pendingForDestruction = true;

    this.onDestroy();
    for (const teardown of this.#teardowns.splice(0).reverse()) {
      teardown();
    }

    this.needUpdate = false;
    this.actor.world.sceneManager.actors.detachComponent(this);
  }

  protected onDestroy(): void {
    return;
  }
}

function hasUpdateHook(
  component: Component
): boolean {
  return typeof component.update === "function" ||
    typeof component.fixedUpdate === "function";
}
