// Import Third-party Dependencies
import chokidar, { type ChokidarOptions } from "chokidar";

// Import Internal Dependencies
import { toRelativePosix } from "../../paths.ts";
import type { AssetPathMatcher } from "./ignoredPaths.ts";

type FilesystemEvent = "add" | "change" | "unlink";
type FilesystemListener = (absolute: string) => void;

export interface FilesystemWatchHandle {
  on(
    event: FilesystemEvent,
    listener: FilesystemListener
  ): FilesystemWatchHandle;
  removeAllListeners(): FilesystemWatchHandle;
  close(): Promise<void>;
}

export type FilesystemWatchFactory = (
  root: string,
  options: ChokidarOptions
) => FilesystemWatchHandle;

export interface FilesystemAssetWatcherOptions {
  root: string;
  isIgnored: AssetPathMatcher;
  watch?: FilesystemWatchFactory;
}

export class FilesystemAssetWatcher {
  #watcher: FilesystemWatchHandle | null;

  constructor(
    options: FilesystemAssetWatcherOptions,
    onChange: (assetPath: string) => void
  ) {
    const watch = options.watch ?? chokidar.watch;
    this.#watcher = watch(options.root, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 30
      },
      ignored: (absolute: string) => {
        const relative = toRelativePosix(
          options.root,
          absolute
        );

        return relative !== null && options.isIgnored(relative);
      }
    });

    function notify(
      absolute: string
    ): void {
      const relative = toRelativePosix(
        options.root,
        absolute
      );
      if (
        relative === null ||
        options.isIgnored(relative)
      ) {
        return;
      }

      onChange(relative);
    }
    this.#watcher
      .on("add", notify)
      .on("change", notify)
      .on("unlink", notify);
  }

  close(): void {
    const watcher = this.#watcher;
    if (watcher === null) {
      return;
    }

    this.#watcher = null;
    watcher.removeAllListeners();
    void watcher.close();
  }
}
