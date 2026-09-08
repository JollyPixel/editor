// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import type { ChokidarOptions } from "chokidar";

// Import Internal Dependencies
import {
  FilesystemAssetWatcher,
  type FilesystemWatchHandle
} from "#src/persistence/filesystem/FilesystemAssetWatcher.ts";

type FilesystemEvent = "add" | "change" | "unlink";
type FilesystemListener = (absolute: string) => void;

class FakeWatchHandle implements FilesystemWatchHandle {
  readonly listeners = new Map<FilesystemEvent, FilesystemListener>();
  closeCount = 0;
  removeAllListenersCount = 0;

  on(
    event: FilesystemEvent,
    listener: FilesystemListener
  ): FilesystemWatchHandle {
    this.listeners.set(event, listener);

    return this;
  }

  removeAllListeners(): FilesystemWatchHandle {
    this.removeAllListenersCount += 1;
    this.listeners.clear();

    return this;
  }

  close(): Promise<void> {
    this.closeCount += 1;

    return Promise.resolve();
  }

  emit(
    event: FilesystemEvent,
    absolute: string
  ): void {
    this.listeners.get(event)?.(absolute);
  }
}

interface WatchHarness {
  readonly handle: FakeWatchHandle;
  readonly options: ChokidarOptions;
  readonly watcher: FilesystemAssetWatcher;
}

function watchHarness(
  root: string,
  onChange: (assetPath: string) => void,
  isIgnored: (assetPath: string) => boolean = () => false
): WatchHarness {
  const handle = new FakeWatchHandle();
  let options: ChokidarOptions = {};
  let started = false;
  function watch(
    watchedRoot: string,
    watchedOptions: ChokidarOptions
  ): FakeWatchHandle {
    assert.strictEqual(watchedRoot, root);
    options = watchedOptions;
    started = true;

    return handle;
  }
  const watcher = new FilesystemAssetWatcher(
    {
      root,
      isIgnored,
      watch
    },
    onChange
  );
  assert.strictEqual(started, true);

  return {
    handle,
    options,
    watcher
  };
}

describe("FilesystemAssetWatcher", () => {
  test("reports file events as root-relative POSIX paths", () => {
    const root = path.resolve("workspace");
    const changes: string[] = [];
    const { handle } = watchHarness(
      root,
      (assetPath) => changes.push(assetPath)
    );
    const absolute = path.join(root, "textures", "grass.png");

    handle.emit("add", absolute);
    handle.emit("change", absolute);
    handle.emit("unlink", absolute);

    assert.deepEqual(changes, [
      "textures/grass.png",
      "textures/grass.png",
      "textures/grass.png"
    ]);
  });

  test("filters ignored paths and paths outside the root", () => {
    const root = path.resolve("workspace");
    const changes: string[] = [];
    const { handle } = watchHarness(
      root,
      (assetPath) => changes.push(assetPath),
      (assetPath) => assetPath.endsWith(".log")
    );

    handle.emit("add", path.join(root, "debug.log"));
    handle.emit("add", path.resolve(root, "..", "outside.png"));
    handle.emit("add", path.join(root, "sprite.png"));

    assert.deepEqual(changes, ["sprite.png"]);
  });

  test("configures initial events, stable writes, and traversal ignores", () => {
    const root = path.resolve("workspace");
    const { options } = watchHarness(
      root,
      () => undefined,
      (assetPath) => assetPath === "ignored/file.png"
    );

    assert.strictEqual(options.persistent, true);
    assert.strictEqual(options.ignoreInitial, false);
    assert.deepEqual(options.awaitWriteFinish, {
      stabilityThreshold: 120,
      pollInterval: 30
    });
    assert.strictEqual(typeof options.ignored, "function");
    if (typeof options.ignored !== "function") {
      throw new Error("expected a Chokidar ignore function");
    }
    assert.strictEqual(options.ignored(root), false);
    assert.strictEqual(
      options.ignored(path.join(root, "ignored", "file.png")),
      true
    );
  });

  test("closes the underlying watcher once", () => {
    const root = path.resolve("workspace");
    const { handle, watcher } = watchHarness(root, () => undefined);

    watcher.close();
    watcher.close();

    assert.strictEqual(handle.removeAllListenersCount, 1);
    assert.strictEqual(handle.closeCount, 1);
  });
});
