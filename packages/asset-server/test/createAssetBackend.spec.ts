// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
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

class FolderlessSource extends MemoryAssetSource {
  override folders(): Promise<string[]> {
    return Promise.reject(new Error("folders unavailable"));
  }
}

function countSubscriptions(
  t: TestContext,
  eventStore: EventStore.EventStore
): () => number {
  let active = 0;
  function counted(
    unsubscribe: () => void
  ): () => void {
    active++;

    return () => {
      active--;
      unsubscribe();
    };
  }

  const subscribe = eventStore.subscribe.bind(eventStore);
  const subscribeRejections = eventStore.subscribeRejections.bind(eventStore);
  t.mock.method(
    eventStore,
    "subscribe",
    (...args: Parameters<typeof subscribe>) => counted(subscribe(...args))
  );
  t.mock.method(
    eventStore,
    "subscribeRejections",
    (...args: Parameters<typeof subscribeRejections>) => counted(
      subscribeRejections(...args)
    )
  );

  return () => active;
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
    reconcile: {
      debounce: 1
    }
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
      reconcile: {
        watch: false
      }
    });

    await source.write("maps/a.png", bytes("a"));
    const report = (await backend.reconcile()).unwrap();

    assert.strictEqual(report.created, 1);
    assert.strictEqual(backend.catalog.size, 1);
    assert.deepEqual(backend.folders.toJSON(), ["maps"]);
  });
});

describe("createAssetBackend — projection state", () => {
  test("a new event log ignores the checkpoints of the previous one", async() => {
    const source = new MemoryAssetSource();
    const actor: EventStore.Actor = {
      type: "user",
      id: "tester"
    };
    function open(): Promise<AssetBackend> {
      return createAssetBackend({
        source,
        eventStore: EventStore.persistence.memory(),
        reconcile: {
          watch: false
        }
      });
    }

    const first = await open();
    await first.writer.create({
      path: "a.png",
      data: bytes("first"),
      assetId: "a1",
      actor
    });
    for (const revision of ["two", "three", "four"]) {
      await first.writer.update({
        assetId: "a1",
        data: bytes(revision),
        actor
      });
    }
    await first.writer.remove({
      assetId: "a1",
      actor
    });
    await first.close();

    await using second = await open();
    await second.writer.create({
      path: "a.png",
      data: bytes("again"),
      assetId: "a1",
      actor
    });
    await second.flush();

    assert.deepEqual(await source.read("a.png"), bytes("again"));
  });
});

describe("createAssetBackend — append errors", () => {
  test("leaves a failed conditional append to the appender", async() => {
    const { logger, records } = recordingLogger();
    await using backend = await createAssetBackend({
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory(),
      reconcile: {
        watch: false
      },
      logger
    });

    const appended = await backend.eventStore.writer.append({
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

describe("createAssetBackend — failed open", () => {
  test("releases its event store subscriptions", async(t) => {
    const eventStore = EventStore.persistence.memory();
    const activeSubscriptions = countSubscriptions(t, eventStore);

    await assert.rejects(
      createAssetBackend({
        source: new FolderlessSource(),
        eventStore,
        reconcile: {
          watch: false
        }
      }),
      /folders unavailable/
    );

    assert.strictEqual(activeSubscriptions(), 0);
  });
});
