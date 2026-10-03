// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetWriter
} from "#src/index.ts";
import { IdentitySidecar } from "#src/identity/index.ts";
import {
  AssetProjector,
  ProjectionState
} from "#src/projection/index.ts";
import {
  Reconciler,
  SourceWatcher,
  type SourceChangeHandler
} from "#src/reconcile/index.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";
import { bytes } from "../helpers/bytes.ts";

function lifecycleCount(
  eventStore: EventStore.EventStore
): number {
  return eventStore.reader.listAll({ eventTypePrefix: "asset." }).length;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for the watcher");
    }

    await setTimeout(25);
  }
}

function recordingWatcher(
  onChange: SourceChangeHandler = async() => void 0
): { watcher: SourceWatcher; passes: string[][]; } {
  const passes: string[][] = [];
  const watcher = new SourceWatcher({
    source: new MemoryAssetSource(),
    debounce: 100,
    onChange: (files) => {
      passes.push([...files].sort());

      return onChange(files);
    }
  });

  return {
    watcher,
    passes
  };
}

describe("SourceWatcher — debounce", () => {
  test("coalesces a burst of notifications into one call", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { watcher, passes } = recordingWatcher();

    watcher.notify("a.png", "file");
    watcher.notify("maps", "folder");
    watcher.notify("c.png", "file");
    t.mock.timers.tick(100);
    await watcher.settle();

    assert.deepEqual(passes, [["a.png", "c.png"]]);
  });

  test("reports a path notified twice once", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { watcher, passes } = recordingWatcher();

    watcher.notify("a.png", "file");
    watcher.notify("a.png", "file");
    t.mock.timers.tick(100);
    await watcher.settle();

    assert.deepEqual(passes, [["a.png"]]);
  });

  test("a burst that settles during a call runs one more call", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { watcher, passes } = recordingWatcher(async() => {
      if (passes.length === 1) {
        watcher.notify("maps", "folder");
        t.mock.timers.tick(100);
      }
    });

    watcher.notify("a.png", "file");
    t.mock.timers.tick(100);
    await watcher.settle();

    assert.deepEqual(passes, [["a.png"], []]);
  });

  test("keeps calling after a failing handler", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { watcher, passes } = recordingWatcher(
      () => Promise.reject(new Error("folders unreadable"))
    );

    watcher.notify("a.png", "file");
    t.mock.timers.tick(100);
    await watcher.settle();
    watcher.notify("b.png", "file");
    t.mock.timers.tick(100);
    await watcher.settle();

    assert.strictEqual(passes.length, 2);
  });

  test("close leaves no timer armed", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { watcher, passes } = recordingWatcher();

    watcher.notify("a.png", "file");
    await watcher.close();
    t.mock.timers.tick(1_000);
    await watcher.settle();

    assert.deepEqual(passes, []);
  });

  test("start is a no-op for a source without watch", async() => {
    const { watcher } = recordingWatcher();

    await watcher.start();

    assert.strictEqual(watcher.watching, false);
  });
});

describe("SourceWatcher — real filesystem (integration)", () => {
  test("a file written outside the editor reaches the log", async() => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    const source = new FilesystemAssetSource(workspace.root);
    const kinds = new AssetKindRegistry();
    const state = await ProjectionState.load(source);
    const projector = new AssetProjector({ source, eventStore, state });
    projector.load();
    projector.start();
    const identity = await IdentitySidecar.load(source);
    const writer = new AssetWriter({
      eventStore,
      kinds,
      projector,
      identity
    });
    const reconciler = new Reconciler({ source, projector, writer });
    const watcher = new SourceWatcher({
      source,
      onChange: async(files) => {
        await reconciler.reconcile(files);
      },
      debounce: 50
    });
    await watcher.start();

    try {
      assert.strictEqual(watcher.watching, true);

      await fs.writeFile(
        path.join(workspace.root, "external.png"),
        bytes("from a tool")
      );
      await waitFor(() => lifecycleCount(eventStore) === 1);

      const [event] = eventStore.reader.listAll({
        eventTypePrefix: "asset."
      });
      assert.strictEqual(event.eventType, "asset.created");
      assert.deepEqual(event.actor, {
        type: "system",
        source: "fs-watcher"
      });
    }
    finally {
      await watcher.close();
      await projector.close();
    }
  });
});

describe("SourceWatcher browser timers", () => {
  test("clears numeric debounce handles on close", async(t) => {
    const { watcher } = recordingWatcher();
    t.mock.method(globalThis, "setTimeout", () => 1);
    const clear = t.mock.method(globalThis, "clearTimeout", () => void 0);

    watcher.notify("a.bin", "file");
    await watcher.close();

    assert.equal(clear.mock.calls[0].arguments[0], 1);
  });
});
