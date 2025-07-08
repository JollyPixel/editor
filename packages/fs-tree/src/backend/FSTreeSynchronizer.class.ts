/* eslint-disable arrow-body-style */
// Import Node.js Dependencies
import { promises as fs } from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import { FSTree } from "./FSTree.class.js";
import { FSTreeWatcher } from "./FSTreeWatcher.class.js";
import type { FSTreeFsOperations, FSTreeTag } from "./types.js";

type PendingOperation = () => Promise<void>;

export interface FSTreeSynchronizerOptions {
  /**
   * Delay in milliseconds between FS synchronizations.
   * @default FSTreeSynchronizer.Configs.delay
   */
  delay?: number;
  /**
   * @default true
   */
  keepEventLoopAlive?: boolean;

  /**
   * If enabled, will refresh the synchronization interval if
   * the last operation was performed within the delay time.
   *
   * @default true
   */
  refreshInterval?: boolean;

  /**
   * If enabled, will watch for changes in the tree on the filesystem.
   *
   * @default false
   */
  watch?: boolean;
}

export class FSTreeSynchronizer {
  static Configs = Object.seal({
    delay: 5_000
  });

  lastOperationTimestamp: number = Date.now();

  #tree: FSTree;
  #treeEventListener: (operation: FSTreeFsOperations, tag: FSTreeTag) => void;
  #pendingOperations: PendingOperation[] = [];

  #synchronizationDelay: number;
  #synchronizationInterval: NodeJS.Timeout | null = null;
  #refreshInterval: boolean;

  #watcher: FSTreeWatcher | null = null;

  constructor(
    tree: FSTree,
    options: FSTreeSynchronizerOptions = {}
  ) {
    const {
      delay = FSTreeSynchronizer.Configs.delay,
      keepEventLoopAlive = true,
      refreshInterval = true,
      watch = false
    } = options;

    this.#refreshInterval = refreshInterval;

    this.#tree = tree;
    this.#treeEventListener = (op, tag) => this.#handleFsOperation(structuredClone(op), tag);
    tree.on(FSTree.Event, this.#treeEventListener);

    this.#synchronizationDelay = delay;
    if (delay > 0) {
      this.#synchronizationInterval = setInterval(
        this.#handleSynchronizationInterval.bind(this),
        delay
      );
      !keepEventLoopAlive && this.#synchronizationInterval.unref();
    }

    if (watch) {
      this.#watcher = new FSTreeWatcher(tree);
    }
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  #handleSynchronizationInterval() {
    this.synchronize();
  }

  #handleFsOperation(
    operation: FSTreeFsOperations,
    tag: FSTreeTag
  ): void {
    if (tag && this.#watcher && this.#watcher.resolveTag(tag)) {
      // If the tag is resolved, it means the operation was triggered by the watcher
      return;
    }

    const timestamp = Date.now();

    if (
      this.#refreshInterval &&
      this.#synchronizationInterval !== null &&
      (timestamp - this.lastOperationTimestamp < this.#synchronizationDelay)
    ) {
      this.#synchronizationInterval.refresh();
    }
    this.lastOperationTimestamp = timestamp;

    this.#pendingOperations.push(
      this.#transformOperation(operation)
    );

    if (this.#synchronizationInterval === null) {
      this.synchronize();
    }
  }

  #transformOperation(
    operation: FSTreeFsOperations
  ) {
    const rootDir = this.#tree.root;

    return match(operation)
      .with(
        { action: "mkdir" },
        (operation) => () => fs.mkdir(path.join(rootDir, operation.from))
      )
      .with(
        { action: "rmdir" },
        (operation) => () => fs.rm(path.join(rootDir, operation.from), { recursive: true, force: true })
      )
      .with(
        { action: "mvdir" },
        (operation) => () => {
          return fs.cp(
            path.join(rootDir, operation.from),
            path.join(rootDir, operation.to),
            { recursive: true }
          );
        }
      )
      .with(
        { action: "unlink" },
        (operation) => () => fs.unlink(path.join(rootDir, operation.file.name))
      )
      .with(
        { action: "copy" },
        (operation) => () => {
          return fs.copyFile(
            path.join(rootDir, operation.from),
            path.join(rootDir, operation.to)
          );
        }
      )
      .with(
        { action: "append" },
        (_operation) => () => Promise.resolve()
      )
      .with(
        { action: "update" },
        (operation) => () => {
          if (operation.previousFile.name === operation.file.name) {
            return Promise.resolve();
          }

          return fs.rename(
            path.join(rootDir, operation.previousFile.name),
            path.join(rootDir, operation.file.name)
          );
        }
      )
      .exhaustive();
  }

  async synchronize(): Promise<void> {
    if (this.#pendingOperations.length === 0) {
      return;
    }

    const currentOps = this.#pendingOperations.slice(0);
    this.#pendingOperations = [];
    await Promise.allSettled(
      currentOps.map((op) => op())
    );
  }

  async close() {
    if (this.#synchronizationInterval) {
      clearInterval(this.#synchronizationInterval);
      this.#synchronizationInterval = null;
    }
    this.#tree.removeListener(
      FSTree.Event,
      this.#treeEventListener
    );

    if (this.#watcher) {
      await this.#watcher.close();
      this.#watcher = null;
    }

    await this.synchronize();
  }
}
