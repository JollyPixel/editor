// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";
import {
  AssetBatchLoadError,
  type AssetLoadFailure
} from "../errors/AssetBatchLoadError.ts";

export type AssetLoadBatchStatus =
  | "loading"
  | "ready"
  | "failed";

interface AssetLoadProgressBase {
  readonly completed: number;
  readonly total: number;
  readonly record: AssetRecord;
}

interface ReadyAssetLoadProgress extends AssetLoadProgressBase {
  readonly status: "ready";
}

interface FailedAssetLoadProgress extends AssetLoadProgressBase {
  readonly status: "failed";
  readonly error: unknown;
}

export type AssetLoadProgress =
  | ReadyAssetLoadProgress
  | FailedAssetLoadProgress;

export interface AssetLoadBatchOptions {
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

interface ReadyAssetLoadResult {
  readonly record: AssetRecord;
  readonly status: "ready";
}

interface FailedAssetLoadResult extends AssetLoadFailure {
  readonly status: "failed";
}

type AssetLoadResult =
  | ReadyAssetLoadResult
  | FailedAssetLoadResult;

function isFailedAssetLoadResult(
  result: AssetLoadResult
): result is FailedAssetLoadResult {
  return result.status === "failed";
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

      return;
    }

    this.#status = "loading";
    this.done = this.#run(pendingTasks);
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
    const results = await Promise.all(
      tasks.map((task) => this.#runTask(task))
    );
    this.#failures = results.filter(
      isFailedAssetLoadResult
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
  ): Promise<AssetLoadResult> {
    let result: AssetLoadResult;

    try {
      await task.load();
      result = {
        record: task.record,
        status: "ready"
      };
    }
    catch (error: unknown) {
      result = {
        record: task.record,
        status: "failed",
        error
      };
    }

    this.#completed++;
    this.#reportProgress({
      ...result,
      completed: this.#completed,
      total: this.total
    });

    return result;
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
