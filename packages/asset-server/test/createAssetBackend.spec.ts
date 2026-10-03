// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  MemoryAssetSource,
  type AssetEntryType,
  type AssetWatchOptions
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  createAssetBackend,
  type AssetBackend
} from "#src/index.ts";
import { bytes } from "./helpers/bytes.ts";
import { recordingLogger } from "./helpers/logger.ts";

type ChangeListener = (path: string, type: AssetEntryType) => void;

class WatchedSource extends MemoryAssetSource {
  #listener: ChangeListener | null = null;

  watch(
    onChange: ChangeListener,
    options: AssetWatchOptions = {}
  ): () => void {
    this.#listener = onChange;
    options.onReady?.();

    return () => {
      this.#listener = null;
    };
  }

  notify(
    path: string,
    type: AssetEntryType
  ): void {
    this.#listener?.(path, type);
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for the backend");
    }

    await setTimeout(5);
  }
}

async function watchedBackend(
  source: WatchedSource
): Promise<AssetBackend> {
  return createAssetBackend({
    source,
    eventStore: EventStore.persistence.memory(),
    reconcileDebounce: 1
  });
}

describe("createAssetBackend — source changes", () => {
  test("a folder change refreshes the folders without reconciling", async() => {
    const source = new WatchedSource();
    await using backend = await watchedBackend(source);

    await source.write("a.png", bytes("a"));
    await source.createFolder("maps");
    source.notify("maps", "folder");
    await waitFor(() => backend.folders.toJSON().includes("maps"));

    assert.strictEqual(backend.catalog.size, 0);
  });

  test("a file change reconciles the source", async() => {
    const source = new WatchedSource();
    await using backend = await watchedBackend(source);

    await source.write("maps/a.png", bytes("a"));
    source.notify("maps/a.png", "file");
    await waitFor(() => backend.catalog.size === 1);

    assert.deepEqual(backend.folders.toJSON(), ["maps"]);
  });
});

describe("createAssetBackend — reconcile", () => {
  test("records external changes and refreshes the folders", async() => {
    const source = new MemoryAssetSource();
    await using backend = await createAssetBackend({
      source,
      eventStore: EventStore.persistence.memory(),
      watch: false
    });

    await source.write("maps/a.png", bytes("a"));
    const report = (await backend.reconcile()).unwrap();

    assert.strictEqual(report.created, 1);
    assert.strictEqual(backend.catalog.size, 1);
    assert.deepEqual(backend.folders.toJSON(), ["maps"]);
  });
});

describe("createAssetBackend — append errors", () => {
  test("leaves a failed conditional append to the appender", async() => {
    const { logger, records } = recordingLogger();
    await using backend = await createAssetBackend({
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory(),
      watch: false,
      logger
    });

    const appended = backend.eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.deleted",
      eventData: {
        path: "a.png",
        kind: "binary"
      },
      actor: {
        type: "system",
        source: "test"
      },
      expectedVersion: 3
    });

    assert.ok(appended.err);
    assert.deepEqual(
      records.filter((record) => record.level === "error"),
      []
    );
  });
});
