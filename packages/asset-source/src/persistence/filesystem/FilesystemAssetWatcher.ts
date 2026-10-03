// Import Third-party Dependencies
import chokidar, { type ChokidarOptions } from "chokidar";

// Import Internal Dependencies
import type { AssetEntryType } from "../../AssetSource.ts";
import { toRelativePosix } from "./toRelativePosix.ts";
import type { AssetPathMatcher } from "./ignoredPaths.ts";

type FilesystemEvent =
  | "add"
  | "addDir"
  | "change"
  | "unlink"
  | "unlinkDir";
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
    onChange: (
      assetPath: string,
      type: AssetEntryType
    ) => void
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
      type: AssetEntryType
    ): FilesystemListener {
      return (absolute) => {
        const relative = toRelativePosix(
          options.root,
          absolute
        );
        if (
          relative !== null &&
          !options.isIgnored(relative)
        ) {
          onChange(relative, type);
        }
      };
    }
    this.#watcher
      .on("add", notify("file"))
      .on("change", notify("file"))
      .on("unlink", notify("file"))
      .on("addDir", notify("folder"))
      .on("unlinkDir", notify("folder"));
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
