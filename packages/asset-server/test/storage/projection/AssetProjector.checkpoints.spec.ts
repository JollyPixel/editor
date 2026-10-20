// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { AssetProjector, ProjectionState } from "#src/storage/projection/index.ts";
import { ContentObjects } from "#src/storage/ContentObjects.ts";
import { syncHarness } from "../../helpers/backend.ts";
import { bytes, text } from "../../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("AssetProjector — checkpoints", () => {
  test("persists checkpoints a second after a single-asset flush", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush(created.assetId);
    t.mock.timers.tick(1_000);
    await harness.projector.flush(created.assetId);

    const persisted = await ProjectionState.load(harness.source);
    assert.strictEqual(
      persisted.checkpoint(created.assetId),
      created.eventId
    );
  });

  test("advances only after a successful write", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(
      harness.state.checkpoint(created.assetId),
      created.eventId
    );
  });

  test("a failing write leaves the checkpoint where it was", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });

    source.write = () => Promise.reject(new Error("disk full"));

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(harness.state.checkpoint(created.assetId), 0);
    assert.strictEqual(
      harness.state.failure(created.assetId)?.reason,
      "disk full"
    );
    assert.strictEqual(harness.projector.pending, 1);
  });

  test("the next run repeats a failed write", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });

    const original = source.write.bind(source);
    source.write = () => Promise.reject(new Error("disk full"));

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    source.write = original;
    await harness.projector.flush();

    assert.strictEqual(text(await source.read("a.png")), "hello");
    assert.strictEqual(
      harness.state.checkpoint(created.assetId),
      created.eventId
    );
  });

  test("one stalled asset does not block another", async() => {
    const source = new MemoryAssetSource();
    await using harness = await syncHarness({ source });

    const original = source.write.bind(source);
    source.write = (path, data) => (path === "bad.png" ?
      Promise.reject(new Error("locked")) :
      original(path, data));

    const bad = (await harness.writer.create({
      path: "bad.png",
      data: bytes("x"),
      actor: kActor
    })).unwrap();
    const good = (await harness.writer.create({
      path: "good.png",
      data: bytes("y"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();

    assert.strictEqual(harness.state.checkpoint(bad.assetId), 0);
    assert.strictEqual(
      harness.state.checkpoint(good.assetId),
      good.eventId
    );
    assert.strictEqual(text(await source.read("good.png")), "y");
  });
});

describe("AssetProjector — restart convergence", () => {
  test("replaying the whole log twice yields identical state", async() => {
    using eventStore = EventStore.persistence.memory();
    const first = new MemoryAssetSource();

    {
      await using harness = await syncHarness({ source: first, eventStore });
      const created = (await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      })).unwrap();
      await harness.writer.update({
        assetId: created.assetId,
        data: bytes("two"),
        actor: kActor
      });
      await harness.writer.rename({
        assetId: created.assetId,
        to: "b.png",
        actor: kActor
      });
      await harness.projector.flush();
    }

    const second = new MemoryAssetSource();
    const state = await ProjectionState.load(second);
    const projector = new AssetProjector({
      source: second,
      eventStore,
      state,
      objects: new ContentObjects(second)
    });
    projector.load();
    await projector.flush();

    assert.strictEqual(text(await second.read("b.png")), "two");
    assert.strictEqual((await second.list()).includes("a.png"), false);
  });

  test("an interrupted run converges on restart", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();

    const created = await (async() => {
      await using harness = await syncHarness({ source, eventStore });
      const event = (await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      })).unwrap();
      await harness.projector.flush();

      source.write = () => Promise.reject(new Error("killed"));
      await harness.writer.update({
        assetId: event.assetId,
        data: bytes("two"),
        actor: kActor
      });
      await harness.projector.flush();

      return event;
    })();

    const restarted = new MemoryAssetSource(
      await Promise.all(
        (await source.list()).map(
          async(path) => [path, await source.read(path)] as const
        )
      )
    );
    const state = await ProjectionState.load(restarted);
    const projector = new AssetProjector({
      source: restarted,
      eventStore,
      state,
      objects: new ContentObjects(restarted)
    });
    projector.load();
    await projector.flush();

    assert.strictEqual(text(await restarted.read("a.png")), "two");
    assert.strictEqual(state.checkpoint(created.assetId) > 0, true);
  });
});
