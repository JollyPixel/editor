// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { syncHarness } from "../../helpers/backend.ts";
import { bytes } from "../../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

async function lifecycleEvents(
  eventStore: EventStore.EventStore
): Promise<EventStore.Event[]> {
  return await eventStore.reader.listAll({ eventTypePrefix: "asset." });
}

describe("Reconciler — scoped passes", () => {
  test("reads only the paths it is given", async() => {
    await using harness = await syncHarness();
    for (const path of ["a.png", "b.png"]) {
      await harness.writer.create({
        path,
        data: bytes("hello"),
        actor: kActor
      });
    }
    await harness.projector.flush();
    await harness.source.write("a.png", bytes("edited a"));
    await harness.source.write("b.png", bytes("edited b"));

    const read: string[] = [];
    const original = harness.source.read.bind(harness.source);
    harness.source.read = (path) => {
      read.push(path);

      return original(path);
    };
    const report = (await harness.reconciler.reconcile(["a.png"])).unwrap();

    assert.strictEqual(report.updated, 1);
    assert.deepEqual([...new Set(read)], ["a.png"]);
  });

  test("matches a rename whose two paths are in scope", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    await harness.source.write("b.png", bytes("hello"));
    await harness.source.delete("a.png");
    const report = (
      await harness.reconciler.reconcile(["a.png", "b.png"])
    ).unwrap();

    assert.strictEqual(report.renamed, 1);
    assert.strictEqual(
      harness.projector.desired(created.assetId)?.path,
      "b.png"
    );
  });

  test("widens to the whole source to match half a rename", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    await harness.source.write("b.png", bytes("hello"));
    await harness.source.delete("a.png");
    const report = (await harness.reconciler.reconcile(["a.png"])).unwrap();

    assert.strictEqual(report.renamed, 1);
    assert.strictEqual(report.deleted, 0);
    assert.strictEqual(
      harness.projector.desired(created.assetId)?.path,
      "b.png"
    );
  });

  test("a vanished path in scope is a delete", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    await harness.source.delete("a.png");
    const report = (await harness.reconciler.reconcile(["a.png"])).unwrap();

    assert.strictEqual(report.deleted, 1);
    assert.strictEqual(harness.projector.desired(created.assetId), null);
  });

  test("leaves a file the projector is still writing alone", async() => {
    await using harness = await syncHarness();
    const gate = Promise.withResolvers<void>();
    const write = harness.source.write.bind(harness.source);
    harness.source.write = async(path, data) => {
      await write(path, data);
      if (path === "a.png") {
        await gate.promise;
      }
    };

    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    const flushed = harness.projector.flush();
    while (!harness.projector.isWriting("a.png")) {
      await Promise.resolve();
    }
    const report = (await harness.reconciler.reconcile(["a.png"])).unwrap();
    gate.resolve();
    await flushed;

    assert.deepEqual(report, {
      created: 0,
      updated: 0,
      renamed: 0,
      deleted: 0,
      failed: 0
    });
    assert.strictEqual((await lifecycleEvents(harness.eventStore)).length, 1);
  });
});
