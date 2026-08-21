// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  MemoryAssetSource
} from "#src/index.ts";
import { syncHarness } from "../helpers/backend.ts";
import { counterHandler } from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function lifecycleEvents(
  eventStore: EventStore.EventStore
): EventStore.Event[] {
  return eventStore.reader.listAll({ eventTypePrefix: "asset." });
}

describe("Reconciler — cold start", () => {
  test("emits one create per discovered file and persists the sidecar", async() => {
    const source = new MemoryAssetSource([
      ["a.png", bytes("one")],
      ["nested/b.counter", bytes("2")]
    ]);
    await using harness = await syncHarness({
      source,
      handlers: [counterHandler()]
    });

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 2);
    assert.deepEqual(
      lifecycleEvents(harness.eventStore).map((event) => event.eventType),
      [ASSET_CREATED, ASSET_CREATED]
    );
    assert.strictEqual(
      harness.identity.byPath("nested/b.counter")?.kind,
      "counter"
    );
    assert.strictEqual(harness.identity.byPath("a.png")?.kind, "binary");
  });

  test("a second pass over the same directory emits nothing", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.deepEqual(report, {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
    assert.strictEqual(lifecycleEvents(harness.eventStore).length, 1);
  });

  test("reuses the ids a valid sidecar already carries", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    await source.write(
      ".jollypixel/assets.json",
      bytes(JSON.stringify({
        version: 1,
        assets: [{ id: "kept-id", path: "a.png", kind: "binary" }]
      }))
    );
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();

    assert.strictEqual(
      lifecycleEvents(harness.eventStore)[0].assetId,
      "kept-id"
    );
  });

  test("does not rewrite the files it discovered", async() => {
    const source = new MemoryAssetSource([["a.png", bytes("one")]]);
    let writes = 0;
    const original = source.write.bind(source);
    source.write = (path, data) => {
      if (path === "a.png") {
        writes += 1;
      }

      return original(path, data);
    };
    await using harness = await syncHarness({ source });

    await harness.reconciler.reconcile();
    await harness.projector.flush();

    assert.strictEqual(writes, 0);
    assert.strictEqual(harness.projector.pending, 0);
  });
});

describe("Reconciler — failures", () => {
  test("an entry that cannot be read is counted, not swallowed", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("readable.png", bytes("one"));
    await source.write("broken.png", bytes("two"));

    const read = source.read.bind(source);
    source.read = (path) => (path === "broken.png" ?
      Promise.reject(new Error("EIO")) :
      read(path));

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 1);
    assert.strictEqual(report.failed, 1);
  });

  test("an unreadable path is never mistaken for a deletion", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("kept.png", bytes("one"));
    await harness.reconciler.reconcile();
    await harness.projector.flush();

    const read = source.read.bind(source);
    source.read = (path) => (path === "kept.png" ?
      Promise.reject(new Error("EIO")) :
      read(path));

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.failed, 1);
    assert.strictEqual(report.deleted, 0);
    assert.deepEqual(
      lifecycleEvents(harness.eventStore).map((event) => event.eventType),
      [ASSET_CREATED]
    );
  });

  test("a failing append is counted instead of reported as success", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });
    await source.write("a.png", bytes("one"));

    const append = harness.eventStore.writer.append.bind(
      harness.eventStore.writer
    );
    harness.eventStore.writer.append = (input) => {
      if (input.eventType === ASSET_CREATED) {
        throw new Error("log unavailable");
      }

      return append(input);
    };

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 0);
    assert.strictEqual(report.failed, 1);
  });
});

describe("Reconciler — external drift", () => {
  test("a projector write produces no event", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();

    const before = lifecycleEvents(harness.eventStore).length;
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.deepEqual(report, {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
    assert.strictEqual(
      lifecycleEvents(harness.eventStore).length,
      before
    );
  });

  test("an external write produces exactly one event with the system actor", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();

    await harness.source.write("a.png", bytes("edited"));
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.updated, 1);
    const events = lifecycleEvents(harness.eventStore);
    const last = events.at(-1)!;
    assert.strictEqual(last.eventType, ASSET_UPDATED);
    assert.deepEqual(last.actor, {
      type: "system",
      source: "fs-watcher"
    });
  });

  test("an external rename produces one asset.renamed", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    await harness.source.write("b.png", bytes("hello"));
    await harness.source.delete("a.png");
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.renamed, 1);
    const last = lifecycleEvents(harness.eventStore).at(-1)!;
    assert.strictEqual(last.eventType, ASSET_RENAMED);
    assert.strictEqual(last.assetId, created.assetId);
    assert.deepEqual(
      harness.projector.desired(created.assetId)?.path,
      "b.png"
    );
  });

  test("an ambiguous rename produces delete plus create", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("same"),
      actor: kActor
    });
    await harness.writer.create({
      path: "b.png",
      data: bytes("same"),
      actor: kActor
    });
    await harness.projector.flush();

    await harness.source.delete("a.png");
    await harness.source.delete("b.png");
    await harness.source.write("c.png", bytes("same"));
    await harness.source.write("d.png", bytes("same"));
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.renamed, 0);
    assert.strictEqual(report.deleted, 2);
    assert.strictEqual(report.created, 2);
    const types = lifecycleEvents(harness.eventStore)
      .slice(2)
      .map((event) => event.eventType);
    assert.deepEqual(types, [
      ASSET_DELETED,
      ASSET_DELETED,
      ASSET_CREATED,
      ASSET_CREATED
    ]);
  });

  test("an external delete produces one asset.deleted", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    await harness.source.delete("a.png");
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.deleted, 1);
    assert.strictEqual(
      harness.projector.desired(created.assetId),
      null
    );
  });

  test("git-pull-shaped drift resolves in a single pass", async() => {
    await using harness = await syncHarness();
    for (const [path, content] of [
      ["a.png", "one"],
      ["b.png", "two"],
      ["gone.png", "three"],
      ["moved.png", "four"]
    ] as const) {
      await harness.writer.create({
        path,
        data: bytes(content),
        actor: kActor
      });
    }
    await harness.projector.flush();

    await harness.source.write("a.png", bytes("one-edited"));
    await harness.source.write("b.png", bytes("two-edited"));
    await harness.source.delete("gone.png");
    await harness.source.delete("moved.png");
    await harness.source.write("elsewhere/moved.png", bytes("four"));
    await harness.source.write("added.png", bytes("five"));

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.deepEqual(report, {
      created: 1,
      updated: 2,
      renamed: 1,
      deleted: 1,
      failed: 0
    });

    const second = (await harness.reconciler.reconcile()).unwrap();
    assert.deepEqual(second, {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
  });

  test("the projection is unchanged after reconciling an external edit", async() => {
    await using harness = await syncHarness();
    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();

    await harness.source.write("a.png", bytes("edited"));
    await harness.reconciler.reconcile();
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "edited"
    );
  });
});
