// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { AssetProjector } from "#src/projection/index.ts";
import { countingReads, syncHarness } from "../helpers/backend.ts";
import { bytes, text } from "../helpers/bytes.ts";

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
      state: harness.state,
      objects: harness.objects
    });
    projector.load();

    assert.strictEqual(counter.read, 1);
    assert.strictEqual(
      text((await projector.read(created.assetId))!),
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
      state: harness.state,
      objects: harness.objects
    });
    projector.load();

    const desired = projector.desired(created.assetId)!;
    assert.strictEqual(desired.path, "b.png");
    assert.strictEqual(text((await projector.read(created.assetId))!), "two");
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
      state: harness.state,
      objects: harness.objects
    });
    projector.load();

    assert.strictEqual(projector.desired(created.assetId), null);
  });
});
