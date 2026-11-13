// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";
import { AssetBatchLoadError } from "../errors/AssetBatchLoadError.ts";

export type AssetLoadBatchStatus =
  | "loading"
  | "ready"
  | "failed";

export interface AssetLoadFailure {
  readonly record: AssetRecord;
  readonly error: unknown;
}

interface AssetLoadProgressBase {
  readonly record: AssetRecord;
  readonly completed: number;
  readonly total: number;
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

export interface AssetLoadBatchTask {
  readonly record: AssetRecord;
  load(): Promise<void>;
}

export class AssetLoadBatch {
  readonly total: number;
  readonly done: Promise<void>;

  #status: AssetLoadBatchStatus;
  #completed: number;
  #failures: AssetLoadFailure[] = [];
  #onProgress: AssetLoadBatchOptions["onProgress"];

  constructor(
    pendingTasks: readonly AssetLoadBatchTask[],
    total: number,
    options: AssetLoadBatchOptions
  ) {
    this.total = total;
    this.#completed = total - pendingTasks.length;
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
    const { record } = task;
    let progress: AssetLoadProgress;

    try {
      await task.load();
      progress = {
        record,
        status: "ready",
        completed: ++this.#completed,
        total: this.total
      };
    }
    catch (error: unknown) {
      this.#failures.push({
        record,
        error
      });
      progress = {
        record,
        status: "failed",
        error,
        completed: ++this.#completed,
        total: this.total
      };
    }

    try {
      this.#onProgress?.(progress);
    }
    catch (error: unknown) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}
