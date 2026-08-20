// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetProjector,
  AssetWriter,
  FilesystemAssetSource,
  CatalogIdentitySidecar,
  ProjectionState,
  Reconciler,
  ReconciliationWatcher
} from "#src/index.ts";
import { syncHarness } from "../helpers/backend.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

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

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }
}

describe("ReconciliationWatcher — debounce", () => {
  test("coalesces a burst of notifications into one pass", async() => {
    await using harness = await syncHarness();
    let passes = 0;
    const original = harness.reconciler.reconcile.bind(harness.reconciler);
    harness.reconciler.reconcile = () => {
      passes += 1;

      return original();
    };

    harness.watcher.notify("a.png");
    harness.watcher.notify("b.png");
    harness.watcher.notify("c.png");
    harness.timers.advance(100);
    await harness.watcher.settle();

    assert.strictEqual(passes, 1);
  });

  test("a run requested during a pass repeats it", async() => {
    await using harness = await syncHarness();
    let passes = 0;
    const original = harness.reconciler.reconcile.bind(harness.reconciler);
    harness.reconciler.reconcile = async() => {
      passes += 1;
      if (passes === 1) {
        void harness.watcher.run();
      }

      return original();
    };

    await harness.watcher.run();

    assert.strictEqual(passes, 2);
  });

  test("close leaves no timer armed", async() => {
    const harness = await syncHarness();

    harness.watcher.notify("a.png");
    await harness.watcher.close();

    assert.strictEqual(harness.timers.scheduled, 0);
    await harness[Symbol.asyncDispose]();
  });

  test("start is a no-op for a source without watch", async() => {
    await using harness = await syncHarness();

    harness.watcher.start();

    assert.strictEqual(harness.watcher.watching, false);
  });
});

describe("ReconciliationWatcher — round trip", () => {
  test("an editor write reaches disk and comes back silent", async() => {
    await using harness = await syncHarness();

    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();
    const before = lifecycleCount(harness.eventStore);

    harness.watcher.notify("a.png");
    harness.timers.advance(100);
    await harness.watcher.settle();

    assert.strictEqual(lifecycleCount(harness.eventStore), before);
  });

  test("an external edit becomes an event and leaves the file alone", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();
    const before = lifecycleCount(harness.eventStore);

    await harness.source.write("a.png", bytes("edited"));
    harness.watcher.notify("a.png");
    harness.timers.advance(100);
    await harness.watcher.settle();
    await harness.projector.flush();

    assert.strictEqual(lifecycleCount(harness.eventStore), before + 1);
    assert.strictEqual(harness.projector.pending, 0);
  });
});

describe("ReconciliationWatcher — real filesystem (integration)", () => {
  test("a file written outside the editor reaches the log", async() => {
    await using workspace = await tempWorkspace();
    using eventStore = EventStore.persistence.memory();

    const source = new FilesystemAssetSource(workspace.root);
    const kinds = new AssetKindRegistry();
    const state = await ProjectionState.load(source);
    const projector = new AssetProjector({ source, eventStore, state });
    projector.load();
    projector.start();
    const identity = await CatalogIdentitySidecar.load(source);
    const writer = new AssetWriter({
      eventStore,
      kinds,
      projector,
      identity,
      source
    });
    const reconciler = new Reconciler({ source, projector, writer, kinds });
    const watcher = new ReconciliationWatcher({
      source,
      reconciler,
      debounce: 50
    });
    watcher.start();

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
