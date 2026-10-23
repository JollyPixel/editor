// Import Third-party Dependencies
import chokidar, { type ChokidarOptions } from "chokidar";

// Import Internal Dependencies
import type {
  AssetEntryType,
  AssetWatchOptions
} from "../../AssetSource.ts";
import type { FilesystemTree } from "./FilesystemTree.ts";

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
  on(
    event: "ready",
    listener: () => void
  ): FilesystemWatchHandle;
  removeAllListeners(): FilesystemWatchHandle;
  close(): Promise<void>;
}

export type FilesystemWatchFactory = (
  root: string,
  options: ChokidarOptions
) => FilesystemWatchHandle;

export interface FilesystemAssetWatcherOptions extends AssetWatchOptions {
  watch?: FilesystemWatchFactory;
}

export class FilesystemAssetWatcher {
  #watcher: FilesystemWatchHandle | null;

  constructor(
    tree: FilesystemTree,
    onChange: (
      assetPath: string,
      type: AssetEntryType
    ) => void,
    options: FilesystemAssetWatcherOptions = {}
  ) {
    const watch = options.watch ?? chokidar.watch;
    this.#watcher = watch(tree.root, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 30
      },
      ignored: (absolute: string) => tree.excludes(absolute)
    });

    function notify(
      type: AssetEntryType
    ): FilesystemListener {
      return (absolute) => {
        const assetPath = tree.assetPath(absolute, type);
        if (assetPath !== null) {
          onChange(assetPath, type);
        }
      };
    }
    this.#watcher
      .on("add", notify("file"))
      .on("change", notify("file"))
      .on("unlink", notify("file"))
      .on("addDir", notify("folder"))
      .on("unlinkDir", notify("folder"))
      .on("ready", () => options.onReady?.());
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
