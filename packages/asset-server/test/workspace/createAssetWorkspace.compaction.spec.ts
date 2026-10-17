// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { createAssetWorkspace, type AssetWorkspace } from "#src/node.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kCompactionActor: EventStore.Actor = {
  type: "user",
  id: "tester"
};

describe("createAssetWorkspace — compaction", () => {
  async function editThenReopen(
    compactOnOpen: boolean | undefined,
    eventStore: EventStore.EventStore
  ): Promise<void> {
    const source = new MemoryAssetSource();
    function open(): Promise<AssetWorkspace> {
      return createAssetWorkspace({
        root: "unused",
        source,
        eventStore,
        compactOnOpen,
        backend: { watch: false }
      });
    }

    const first = await open();
    const created = (await first.backend.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kCompactionActor
    })).unwrap();
    await first.backend.writer.update({
      assetId: created.assetId,
      data: bytes("two"),
      actor: kCompactionActor
    });
    await first.backend.flush();
    await first.close();

    const second = await open();
    await second.close();
  }

  test("drops the events superseded by each checkpoint", async() => {
    using eventStore = EventStore.persistence.memory();

    await editThenReopen(undefined, eventStore);

    assert.deepEqual(
      eventStore.reader.listAll().map((event) => event.eventType),
      ["asset.updated"]
    );
  });

  test("keeps the whole log when it is turned off", async() => {
    using eventStore = EventStore.persistence.memory();

    await editThenReopen(false, eventStore);

    assert.deepEqual(
      eventStore.reader.listAll().map((event) => event.eventType),
      ["asset.created", "asset.updated"]
    );
  });

  test("the catalog a reopened workspace serves survives it", async() => {
    using eventStore = EventStore.persistence.memory();
    const source = new MemoryAssetSource();
    function open(): Promise<AssetWorkspace> {
      return createAssetWorkspace({
        root: "unused",
        source,
        eventStore,
        backend: { watch: false }
      });
    }

    const first = await open();
    const created = (await first.backend.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kCompactionActor
    })).unwrap();
    await first.backend.flush();
    await first.close();

    await using second = await open();

    assert.strictEqual(second.backend.catalog.size, 1);
    assert.strictEqual(
      second.backend.catalog.snapshot().assets[0].id,
      created.assetId
    );
  });
});
