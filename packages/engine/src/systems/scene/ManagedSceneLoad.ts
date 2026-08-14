// Import Third-party Dependencies
import type {
  AssetLoadProgress,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Scene } from "./Scene.ts";
import type {
  SceneLoad,
  SceneLoadOptions,
  SceneLoadStatus
} from "./SceneLoad.ts";
import type { WorldDefaultContext } from "../World.ts";

type SceneLoadChangeHandler<TContext> = (
  load: SceneLoad<TContext>
) => void;

/**
 * Stores the mutable state behind the public scene-load read model.
 */
export class ManagedSceneLoad<
  TContext = WorldDefaultContext
> implements SceneLoad<TContext> {
  readonly scene: Scene<TContext>;

  #status: SceneLoadStatus = "requested";
  #activationAllowed: boolean;
  #completed = 0;
  #total = 0;
  #currentAsset: AssetRecord | null = null;
  #error: Error | null = null;
  #onChange: SceneLoadChangeHandler<TContext>;

  constructor(
    scene: Scene<TContext>,
    options: SceneLoadOptions,
    onChange: SceneLoadChangeHandler<TContext>
  ) {
    this.scene = scene;
    this.#activationAllowed = options.activation !== "manual";
    this.#onChange = onChange;
  }

  get status(): SceneLoadStatus {
    return this.#status;
  }

  get activationAllowed(): boolean {
    return this.#activationAllowed;
  }

  get completed(): number {
    return this.#completed;
  }

  get total(): number {
    return this.#total;
  }

  get currentAsset(): AssetRecord | null {
    return this.#currentAsset;
  }

  get error(): Error | null {
    return this.#error;
  }

  allowActivation(): void {
    if (
      this.#activationAllowed ||
      isFinalStatus(this.#status)
    ) {
      return;
    }

    this.#activationAllowed = true;
    this.#notify();
  }

  cancel(): void {
    if (isFinalStatus(this.#status)) {
      return;
    }

    this.#status = "cancelled";
    this.#notify();
  }

  start(
    completed: number,
    total: number
  ): void {
    if (this.#status !== "requested") {
      return;
    }

    this.#status = "loading";
    this.#completed = completed;
    this.#total = total;
    this.#notify();
  }

  report(
    progress: AssetLoadProgress
  ): void {
    if (this.#status !== "loading") {
      return;
    }

    this.#completed = progress.completed;
    this.#total = progress.total;
    this.#currentAsset = progress.record;
    this.#notify();
  }

  ready(): void {
    if (!isLoadingStatus(this.#status)) {
      return;
    }

    this.#status = "ready";
    this.#completed = this.#total;
    this.#notify();
  }

  fail(
    error: Error
  ): void {
    if (!isLoadingStatus(this.#status)) {
      return;
    }

    this.#status = "failed";
    this.#error = error;
    this.#notify();
  }

  activate(): void {
    if (this.#status !== "ready") {
      return;
    }

    this.#status = "active";
    this.#notify();
  }

  #notify(): void {
    this.#onChange(this);
  }
}

function isFinalStatus(
  status: SceneLoadStatus
): boolean {
  return status === "failed" ||
    status === "cancelled" ||
    status === "active";
}

function isLoadingStatus(
  status: SceneLoadStatus
): boolean {
  return status === "requested" || status === "loading";
}
