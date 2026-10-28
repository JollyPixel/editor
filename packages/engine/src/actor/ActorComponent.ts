// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  Actor,
  ActorStatus
} from "./Actor.ts";
import { randomPersistentId } from "../systems/generators/randomPersistentId.ts";
import type {
  WorldDefaultContext
} from "../systems/World.ts";
import type {
  Timer,
  TimerOptions
} from "../systems/Timers.ts";
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
  readonly id: number;
  readonly persistentId = randomPersistentId();
  actor: Actor<TContext>;
  typeName: FreeComponentEnum;

  #needUpdate = false;
  #status: ActorStatus = "alive";
  #teardowns: (() => void)[] = [];
  #timers = new Set<Timer>();

  constructor(
    options: ActorComponentOptions<TContext>
  ) {
    const { actors } = options.actor.world.sceneManager;
    this.actor = options.actor;
    this.typeName = options.typeName;
    this.id = actors.nextComponentId();

    actors.attachComponent(this);
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

  get status(): ActorStatus {
    return this.#status;
  }

  get pendingForDestruction(): boolean {
    return this.#status !== "alive";
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

  schedule(
    seconds: number,
    callback: () => void,
    options: TimerOptions = {}
  ): Timer {
    const timer = this.actor.world.timers.schedule(seconds, () => {
      if (!timer.active) {
        this.#timers.delete(timer);
      }
      if (!this.pendingForDestruction) {
        callback();
      }
    }, options);
    this.#timers.add(timer);

    return timer;
  }

  toString(): string {
    return `${this.typeName}:${this.id}-${this.persistentId}`;
  }

  markDestructionPending(): void {
    if (this.#status !== "alive") {
      return;
    }
    this.#status = "pending";

    this.actor.world.sceneManager.actors.destroyLater(this);
  }

  destroy(): void {
    if (this.#status === "destroyed") {
      return;
    }
    this.#status = "destroyed";

    this.onDestroy();
    for (const timer of this.#timers) {
      timer.cancel();
    }
    this.#timers.clear();
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
