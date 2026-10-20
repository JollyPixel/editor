// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { type AssetProjectionChange } from "#src/storage/projection/index.ts";
import { syncHarness } from "../../helpers/backend.ts";
import { bytes } from "../../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("AssetProjector — desired paths", () => {
  test("assetAt follows creates, renames and deletes", async() => {
    await using harness = await syncHarness();
    const { assetId } = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    assert.strictEqual(harness.projector.assetAt("a.png"), assetId);

    await harness.writer.rename({
      assetId,
      to: "b.png",
      actor: kActor
    });
    assert.strictEqual(harness.projector.assetAt("a.png"), null);
    assert.strictEqual(harness.projector.assetAt("b.png"), assetId);

    await harness.writer.remove({
      assetId,
      actor: kActor
    });
    assert.strictEqual(harness.projector.assetAt("b.png"), null);
  });

  test("load rebuilds the path index from the log", async() => {
    await using harness = await syncHarness();
    const { assetId } = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();

    harness.projector.load();

    assert.strictEqual(harness.projector.assetAt("a.png"), assetId);
  });
});

describe("AssetProjector — changes", () => {
  test("emits the desired state after each folded lifecycle event", async() => {
    await using harness = await syncHarness();
    const changes: AssetProjectionChange[] = [];
    harness.projector.on("changed", (change) => changes.push(change));

    const { assetId } = (await harness.writer.create({
      path: "a.png",
      data: bytes("0"),
      actor: kActor
    })).unwrap();
    harness.eventStore.writer.append({
      assetType: "binary",
      assetId,
      eventType: "asset.updated",
      eventData: { path: "b.png" },
      actor: kActor
    });
    await harness.writer.remove({
      assetId,
      actor: kActor
    });

    assert.deepEqual(
      changes.map(({ eventType, desired }) => [eventType, desired?.path]),
      [
        ["asset.created", "a.png"],
        ["asset.deleted", undefined]
      ]
    );
  });
});
