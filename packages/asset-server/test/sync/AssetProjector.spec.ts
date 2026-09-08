// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  AssetProjector,
  ProjectionState
} from "#src/index.ts";
import {
  decodeContent,
  encodeContent
} from "#src/events/AssetEvents.ts";
import {
  countingReads,
  syncHarness
} from "../helpers/backend.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import { recordingLogger } from "../helpers/logger.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("AssetProjector — load reads the tail of the log", () => {
  test("reads only each asset's newest checkpoint", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    for (let index = 1; index <= 20; index++) {
      await harness.writer.update({
        assetId: created.assetId,
        data: bytes(String(index)),
        actor: kActor
      });
    }
    await harness.projector.flush();

    const counter = countingReads(harness.eventStore);
    const projector = new AssetProjector({
      source: harness.source,
      eventStore: counter.store,
      state: harness.state
    });
    projector.load();

    assert.strictEqual(counter.read, 1);
    assert.strictEqual(
      text(decodeContent(projector.desired(created.assetId)!.content)),
      "20"
    );
  });

  test("folds the renames stored after the checkpoint", async() => {
    await using harness = await syncHarness();
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

    const projector = new AssetProjector({
      source: harness.source,
      eventStore: harness.eventStore,
      state: harness.state
    });
    projector.load();

    const desired = projector.desired(created.assetId)!;
    assert.strictEqual(desired.path, "b.png");
    assert.strictEqual(text(decodeContent(desired.content)), "two");
  });

  test("folds a deletion as the newest checkpoint", async() => {
    await using harness = await syncHarness();
    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    })).unwrap();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });
    await harness.projector.flush();

    const projector = new AssetProjector({
      source: harness.source,
      eventStore: harness.eventStore,
      state: harness.state
    });
    projector.load();

    assert.strictEqual(projector.desired(created.assetId), null);
  });
});

describe("AssetProjector — lifecycle events land on the source", () => {
  test("a create writes the file", async() => {
    await using harness = await syncHarness();

    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "hello"
    );
  });

  test("an update overwrites the file", async() => {
    await using harness = await syncHarness();

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
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "two"
    );
  });

  test("a rename moves the content without re-reading the old path", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "renamed/b.png",
      actor: kActor
    });
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("renamed/b.png")),
      "hello"
    );
    assert.strictEqual(
      (await harness.source.list()).includes("a.png"),
      false
    );
  });

  test("a rename before the first write never touches the old path", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.writer.rename({
      assetId: created.assetId,
      to: "b.png",
      actor: kActor
    });
    await harness.projector.flush();

    const listed = await harness.source.list();
    assert.strictEqual(listed.includes("a.png"), false);
    assert.strictEqual(listed.includes("b.png"), true);
  });

  test("a delete removes the file", async() => {
    await using harness = await syncHarness();

    const created = (await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor
    })).unwrap();
    await harness.projector.flush();
    await harness.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });
    await harness.projector.flush();

    await assert.rejects(() => harness.source.read("a.png"));
  });

  test("markProjected records state without writing", async() => {
    await using harness = await syncHarness();

    await harness.writer.create({
      path: "a.png",
      data: bytes("hello"),
      actor: kActor,
      alreadyProjected: true
    });
    await harness.projector.flush();

    await assert.rejects(() => harness.source.read("a.png"));
    assert.strictEqual(harness.projector.pending, 0);
  });
});

describe("AssetProjector — checkpoints", () => {
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
      state
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

      // Killed before the update reaches the source.
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
      state
    });
    projector.load();
    await projector.flush();

    assert.strictEqual(text(await restarted.read("a.png")), "two");
    assert.strictEqual(state.checkpoint(created.assetId) > 0, true);
  });
});

describe("AssetProjector — malformed events", () => {
  test("a payload that does not match its type is skipped", async() => {
    await using harness = await syncHarness();

    const created = await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    assert.ok(created.ok);
    await harness.projector.flush();

    const appended = harness.eventStore.writer.append({
      assetType: "binary",
      assetId: created.val.assetId,
      eventType: "asset.updated",
      eventData: { path: "a.png", kind: "binary", hash: "h2" },
      actor: kActor
    });
    assert.ok(appended.ok);
    await harness.projector.flush();

    assert.strictEqual(
      text(await harness.source.read("a.png")),
      "one"
    );
    assert.strictEqual(harness.projector.pending, 0);
  });

  test("a malformed event never breaks a full replay", async() => {
    const source = new MemoryAssetSource();
    using eventStore = EventStore.persistence.memory();
    await using harness = await syncHarness({ source, eventStore });

    const created = await harness.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    assert.ok(created.ok);

    const appended = eventStore.writer.append({
      assetType: "binary",
      assetId: created.val.assetId,
      eventType: "asset.renamed",
      eventData: "not-an-object",
      actor: kActor
    });
    assert.ok(appended.ok);

    const replayed = new AssetProjector({
      source,
      eventStore,
      state: await ProjectionState.load(source)
    });

    assert.doesNotThrow(() => replayed.load());
    assert.strictEqual(replayed.desired(created.val.assetId)?.path, "a.png");
  });
});

describe("AssetProjector — rejected events", () => {
  test("warns about a malformed event, naming the offending field",
    async() => {
      const source = new MemoryAssetSource();
      using eventStore = EventStore.persistence.memory();
      await using harness = await syncHarness({ source, eventStore });

      const created = await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      });
      assert.ok(created.ok);
      assert.ok(eventStore.writer.append({
        assetType: "binary",
        assetId: created.val.assetId,
        eventType: "asset.deleted",
        eventData: { path: "a.png" },
        actor: kActor
      }).ok);

      const { logger, records } = recordingLogger();
      new AssetProjector({
        source,
        eventStore,
        state: await ProjectionState.load(source),
        logger
      }).load();

      const warnings = records.filter((record) => record.level === "warn");
      assert.strictEqual(warnings.length, 1);
      assert.strictEqual(warnings[0].metadata.reason, "malformed");
      assert.match(String(warnings[0].metadata.detail), /kind/);
    });

  test("does not warn about an asset event type it does not know",
    async() => {
      const source = new MemoryAssetSource();
      using eventStore = EventStore.persistence.memory();
      await using harness = await syncHarness({ source, eventStore });

      const created = await harness.writer.create({
        path: "a.png",
        data: bytes("one"),
        actor: kActor
      });
      assert.ok(created.ok);
      assert.ok(eventStore.writer.append({
        assetType: "binary",
        assetId: created.val.assetId,
        eventType: "asset.archived",
        eventData: {},
        actor: kActor
      }).ok);

      const { logger, records } = recordingLogger();
      new AssetProjector({
        source,
        eventStore,
        state: await ProjectionState.load(source),
        logger
      }).load();

      assert.deepEqual(
        records.filter((record) => record.level === "warn"),
        []
      );
    });

  test("skips a content reference rather than throwing", async() => {
    const source = new MemoryAssetSource();
    using eventStore = EventStore.persistence.memory();

    assert.ok(eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.created",
      eventData: {
        path: "a.png",
        kind: "binary",
        hash: "h1",
        size: 3,
        content: encodeContent(bytes("one"))
      },
      actor: kActor
    }).ok);
    assert.ok(eventStore.writer.append({
      assetType: "binary",
      assetId: "a1",
      eventType: "asset.updated",
      eventData: {
        path: "a.png",
        kind: "binary",
        hash: "h2",
        size: 3,
        content: {
          type: "ref",
          hash: "h2",
          size: 3
        }
      },
      actor: kActor
    }).ok);

    const { logger, records } = recordingLogger();
    const projector = new AssetProjector({
      source,
      eventStore,
      state: await ProjectionState.load(source),
      logger
    });

    assert.doesNotThrow(() => projector.load());
    assert.strictEqual(projector.desired("a1"), null);
    assert.strictEqual(projector.pending, 0);

    const warnings = records.filter((record) => record.level === "warn");
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].metadata.reason, "unsupported");
  });
});
