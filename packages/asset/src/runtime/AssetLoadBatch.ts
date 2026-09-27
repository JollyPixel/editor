// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";
import { AssetBatchLoadError } from "../errors/AssetBatchLoadError.ts";
import type { AssetLoadContext } from "./AssetLoader.ts";

export type AssetLoadBatchStatus =
  | "loading"
  | "ready"
  | "failed";

export interface AssetLoadFailure {
  readonly record: AssetRecord;
  readonly error: unknown;
}

interface ReadyAssetLoadOutcome {
  readonly record: AssetRecord;
  readonly status: "ready";
}

interface FailedAssetLoadOutcome extends AssetLoadFailure {
  readonly status: "failed";
}

interface AssetLoadCounts {
  readonly completed: number;
  readonly total: number;
}

export type AssetLoadProgress = (
  | ReadyAssetLoadOutcome
  | FailedAssetLoadOutcome
) & AssetLoadCounts;

export interface AssetLoadBatchOptions extends AssetLoadContext {
  onProgress?: (
    progress: AssetLoadProgress
  ) => void;
}

export interface AssetLoadBatch {
  readonly status: AssetLoadBatchStatus;
  readonly completed: number;
  readonly total: number;
  readonly failures: readonly AssetLoadFailure[];
  readonly done: Promise<void>;
}

export interface AssetLoadBatchTask {
  readonly record: AssetRecord;
  readonly ready: boolean;
  load(): Promise<void>;
}

/**
 * Tracks the state and progress of one independent asset loading operation.
 */
class RunningAssetLoadBatch implements AssetLoadBatch {
  readonly total: number;
  readonly done: Promise<void>;

  #status: AssetLoadBatchStatus;
  #completed: number;
  #failures: AssetLoadFailure[] = [];
  #onProgress: AssetLoadBatchOptions["onProgress"];
  #hasProgressError = false;
  #progressError: unknown;

  constructor(
    tasks: readonly AssetLoadBatchTask[],
    options: AssetLoadBatchOptions
  ) {
    const pendingTasks = tasks.filter(
      (task) => !task.ready
    );

    this.total = tasks.length;
    this.#completed = tasks.length - pendingTasks.length;
    this.#onProgress = options.onProgress;

    if (pendingTasks.length === 0) {
      this.#status = "ready";
      this.done = Promise.resolve();
    }
    else {
      this.#status = "loading";
      this.done = this.#run(pendingTasks);
    }
  }

  get status(): AssetLoadBatchStatus {
    return this.#status;
  }

  get completed(): number {
    return this.#completed;
  }

  get failures(): readonly AssetLoadFailure[] {
    return [...this.#failures];
  }

  async #run(
    tasks: readonly AssetLoadBatchTask[]
  ): Promise<void> {
    await Promise.all(
      tasks.map((task) => this.#runTask(task))
    );

    if (this.#hasProgressError) {
      this.#status = "failed";

      throw this.#progressError;
    }
    if (this.#failures.length > 0) {
      this.#status = "failed";

      throw new AssetBatchLoadError(
        this.#failures
      );
    }

    this.#status = "ready";
  }

  async #runTask(
    task: AssetLoadBatchTask
  ): Promise<void> {
    let outcome: ReadyAssetLoadOutcome | FailedAssetLoadOutcome;

    try {
      await task.load();
      outcome = {
        record: task.record,
        status: "ready"
      };
    }
    catch (error: unknown) {
      this.#failures.push({
        record: task.record,
        error
      });
      outcome = {
        record: task.record,
        status: "failed",
        error
      };
    }

    this.#completed++;
    this.#reportProgress({
      ...outcome,
      completed: this.#completed,
      total: this.total
    });
  }

  #reportProgress(
    progress: AssetLoadProgress
  ): void {
    try {
      this.#onProgress?.(progress);
    }
    catch (error: unknown) {
      if (!this.#hasProgressError) {
        this.#hasProgressError = true;
        this.#progressError = error;
      }
    }
  }
}

export function startAssetLoadBatch(
  tasks: Iterable<AssetLoadBatchTask>,
  options: AssetLoadBatchOptions = {}
): AssetLoadBatch {
  return new RunningAssetLoadBatch(
    Array.from(tasks),
    options
  );
}
